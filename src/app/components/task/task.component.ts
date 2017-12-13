import { Component, HostListener, OnInit } from '@angular/core';
import { AudioService, AudioPlayer, AudioRecorder } from '../../providers/audio.service';
import { Router } from '@angular/router';
import { MdDialog, MdDialogRef } from '@angular/material';
import * as fs from 'fs-extra';

const sprintf = require ('sprintf-js');

const storage = require('electron-json-storage');
const log = require('log')
const path = require('path');
const _ = require('lodash');

import { ErrorComponent } from '../error/error.component';
import { FinishComponent } from '../finish/finish.component';
import { ReadyComponent } from '../ready/ready.component';
import { BreakComponent } from '../break/break.component';
import { SettingsService, Settings } from '../../providers/settings.service';

const filterImg = item => /[.](jpg|jpeg|png)/.test(path.extname(item))
const filterWav = item => /[.]wav/.test(path.extname(item))

const COLOR_COUNT = 16;
const DIRECTIONS: Array<string> =  ['top', 'bottom', 'left', 'right'];
const STYLE_OUT = 'out';
const STYLE_IN = 'in';


class Tile {
  constructor(
    public color: number,
    public stack: string,
    public direction: string,
    public style: string,
    public imageSrc: Array<String>,
    public names: Array<String>,
    public active: boolean = false) { };


}


@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss']
})
export class TaskComponent implements OnInit {

  private settings: Settings;
  private stimuli: Array<{word: string, talker: string}>;

  private audioStimuli: any;
  private imageStimuli: any;

  private trial: number;
  private participantFolder: string;
  private now: Date;
  private target: string;
  private stimulus: {word: string, talker: string};
  private responses: Array<string>;

  private player: AudioPlayer;

  private keyboardBuffer: Array<string>;

  private dialogRefs: any;

  private finish: boolean;
  private abort: boolean;

  private taskRunning: boolean;
  private trialRunning: boolean;

  public tiles: Array<Tile>;
  private incomingTileIndex: number;
  private savedTileColor: number;

  private log;
  public transition: boolean;

  public words: string[];
  public talkers: string[];

  constructor(
      private router: Router,
      private audio: AudioService,
      public dialog: MdDialog,
      public settingsService: SettingsService) {

    this.audio.initialise();
    this.player = audio.player;
    this.player.initialise();

    this.keyboardBuffer = [];


    this.stimuli = new Array<any>();
    this.audioStimuli = {};
    this.imageStimuli = {};
    this.settings = settingsService.settings;

    this.trial = 0;
    this.taskRunning = false;
    this.trialRunning = false;
    this.dialogRefs = {};
    this.abort = false;

    this.tiles = new Array<Tile>();
    this.tiles.push(new Tile(0, 'back', 'top', 'out', null, []));
    this.tiles.push(new Tile(0, 'front', 'left', 'in', null, []));
    this.incomingTileIndex = 0;
    this.savedTileColor = null;
    this.log = null;

    this.words = [];
    this.talkers = [];

  }

  private loadStimuli() {
    return new Promise((resolve, reject) => {
      this.loadAudioStimuli().then(() => this.loadImageStimuli()).then(() => resolve())
    });
  }

  private loadAudioStimuli() {
    return new Promise((resolve, reject) => {
      console.log(`Loading wav files from ${this.settings.stimuliPathAudio}`);
      const stimuli = fs.readdirSync(this.settings.stimuliPathAudio)
        .filter(filterWav)
        .map(wav => path.join(this.settings.stimuliPathAudio, wav));
      if (stimuli.length === 0) {
        this.openDialog('error', ErrorComponent, {
          data: {
            title: 'Ooops!',
            content: 'There were no WAV files in the audio stimuli folder'
          }
        },
        () => {
            this.router.navigateByUrl('');
          });
      }
      console.log(`Loaded ${stimuli.length} audio paths.`);
      const words = new Set()
      const talkers = new Set()
      stimuli.map(stimulus => {
        const base = this.getBase(stimulus);
        const [word, talker] = base.split('-');
        words.add(word);
        talkers.add(talker);
      })
      this.words = Array.from(words);
      this.talkers = Array.from(talkers);
      console.log(`${this.words.length} words and ${this.talkers.length} talkers`);
      this.audioStimuli = stimuli.reduce((obj, stimulus) => Object.assign(obj, {[this.getBase(stimulus)]: stimulus}), {})
      if (this.settings.stratifiedSampling) {
        const totalStimuli = this.words.length * this.settings.repetitions
        const n = Math.ceil(totalStimuli / this.talkers.length)
        this.words = _.shuffle(this.words)
        const wordArray = _.flatten(_.times(this.settings.repetitions, () => this.words.slice()));
        this.stimuli = this.talkers
          .reduce((arr, talker, i) => arr.concat(
            wordArray.slice(i * n, i * n + n)
              .map((word: string) => ({ word, talker }))
            ), [])
        resolve()
      } else {
        this.stimuli = Object.keys(this.audioStimuli).map((stimulus: string) => {
          const base = this.getBase(stimulus);
          const [word, talker] = base.split('-');
          return { word, talker }
        });
        if (this.settings.repetitions > 1) {
          this.stimuli = _.flatten(_.times(this.settings.repetitions, () => this.stimuli));
        }
        console.log(`Total audio stimuli (including repetitions): ${this.stimuli.length}`)
        resolve();
      }
    });
  }

  private loadImageStimuli() {
    return new Promise((resolve, reject) => {
      console.log(`Loading image files from ${this.settings.stimuliPathImage}`);
      const stimuli = fs.readdirSync(this.settings.stimuliPathImage)
        .filter(filterImg)
        .map(img => path.join(this.settings.stimuliPathImage, img));
      if (stimuli.length === 0) {
        this.openDialog('error', ErrorComponent, {
          data: {
            title: 'Ooops!',
            content: 'There were no image files in the image stimuli folder'
          }
        },
        () => {
            this.router.navigateByUrl('');
          });
      }
      console.log(`Loaded ${stimuli.length} image paths.`);
      this.imageStimuli = stimuli.reduce((obj, stimulus) => Object.assign(obj, {[this.getBase(stimulus)]: stimulus}), {})
      resolve();
    });
  }

  private getBase(filePath): string {
    const isWindows: boolean = path.sep === '//';
    const pathApi = isWindows ? path.win32 : path;
    return pathApi.basename(filePath, path.extname(filePath))
  }

  private getDistractors(target: string): Array<string> {
    return _.sampleSize(_.filter(this.stimuli, (stimulus) => stimulus !== target), 2);
  }

  private runTask() {
    const now = new Date();
    this.participantFolder = sprintf.sprintf('%04d%02d%02d-%02d%02d%02d',
      now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    const participantPath = path.normalize(path.join(this.settings.responsesPath, this.participantFolder));
    try {
      fs.mkdirpSync(participantPath);
    } catch (err) {
      console.log(`Could not create directory ${participantPath}`);
    }
    this.log = fs.createWriteStream(path.join(participantPath, 'results.txt'))
    this.writeRow('trial', ['image1', 'image2', 'image3'], 'target', 'response', 'speaker')
    this.stimuli = _.shuffle(this.stimuli);
    this.finish = false;
    this.abort = false;
    this.taskRunning = true;
    this.trial = 0;
    this.runTrial();
  }

  private writeRow(trial, images, target, response, speaker) {
    const row = sprintf.sprintf('%10s %10s %10s %10s %10s %10s %10s\n',
      (trial).toString(), images[0], images[1], images[2], target, response, speaker)
    this.log.write(row)
  }

  private cleanUp() {
    if (this.log) {
      this.log.close();
    }
  }

  private runTrial() {
    console.log(`Trial ${this.trial + 1}`)
    this.startTrial()
      .then(() => this.showImages())
      .then(() => this.loadAudio())
      .then(() => this.playAudio())
      .catch((err) => {
        console.error(err)
      }) ;
  }

  private startTrial() {
    this.trialRunning = true;
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  private showImages() {
    let i: number;
    return new Promise((resolve, reject) => {
      i = this.trial % this.stimuli.length;
      this.stimulus = this.stimuli[i];
      this.target = this.stimulus.word;
      this.responses = _.shuffle(_.sampleSize(
          Object.keys(this.imageStimuli).filter(image => image !== this.target), 2).concat([this.target]))
      this.updateTiles(this.responses.map(image => this.imageStimuli[image]))
      setTimeout(() => resolve(), 2000);
    });
  }

  private loadAudio() {
    return new Promise((resolve, reject) => {
      const audio = `${this.stimulus.word}-${this.stimulus.talker}`;
      console.log('Loading audio', this.audioStimuli[audio]);
      this.player.loadWav(this.audioStimuli[audio])
        .then(() => resolve())
        .catch((err) => {
          console.error(err);
        });
    });
  }

  private playAudio() {
    this.transition = false;
    this.player.play();
  }

  replay() {
    if (!this.transition && !this.player.playing()) {
      this.playAudio();
    }
  }

  private collectResponse(i: number) {
    if (this.transition) {
      return;
    }
    this.player.stop();
    const inTile = this.tiles[this.incomingTileIndex];
    this.writeRow(this.trial + 1, inTile.names, this.target, inTile.names[i], this.stimulus.talker);
    this.endTrial();
  }


  private endTrial() {
    this.trial ++;
    if (this.abort) {
      return;
    }
    if (this.trial >= this.stimuli.length) {
      this.updateTiles(null);
      this.transition = true;
      setTimeout(() => {
        this.endTask();
      }, 2000);
    } else {
      if (this.trial % this.settings.blockSize === 0) {
        this.updateTiles(null);
        this.transition = true;
        setTimeout(() => {
          this.break()
        }, 1500);
      } else {
        this.runTrial();
      }
    }
  }

  private updateTiles(imageSrc?: Array<string>) {
    const i = this.trial % this.stimuli.length;
    const outgoingTileIndex: number = this.incomingTileIndex;
    this.incomingTileIndex = 1 - this.incomingTileIndex;

    const inTile = this.tiles[this.incomingTileIndex];
    const outTile = this.tiles[1 - this.incomingTileIndex];
    const directions = _.sampleSize(DIRECTIONS, 2);
    if (imageSrc) {
      this.loadImageSrc(imageSrc).then((results) => {
        const src = [];
        results.map(result => src[result['index']] = result['data']);
        inTile.imageSrc = src;
        inTile.names = results.map(result => this.getBase(result['path']))
        inTile.color = _.sample(_.range(1, COLOR_COUNT).filter(count => count !== outTile.color));
        inTile.style = STYLE_IN;
        inTile.direction = directions[0];

        outTile.style = STYLE_OUT;
        outTile.direction = directions[1];
        inTile.active = true;
        this.transition = true;
        setTimeout(() => {
          this.transition = false;
          this.tiles[outgoingTileIndex].imageSrc = null;
        }, 2000);
      });
    } else {
      inTile.imageSrc = null;
      inTile.names = null;
      inTile.color = 0;
      inTile.style = STYLE_IN;
      inTile.direction = directions[0];

      outTile.style = STYLE_OUT;
      outTile.direction = directions[1];
      inTile.active = false;
    }
  }

  private loadImageSrc(imageSrc: Array<string>) {
    return Promise.all(
      imageSrc.map((src, i) => new Promise((resolve, reject) => {
        console.log(`Loading image: ${src}`)
        fs.readFile(src, (err, buffer) => {
          resolve({path: src, index: i, data: buffer.toString('base64')});
        })
      })));
  }

  public getImageSrc(imageSrc: string) {
    return `data:image/png;base64,${imageSrc}`;
  }

  private endTask() {
    this.openDialog('finish', FinishComponent,  {
      disableClose: true
    },
    () => {
      this.router.navigateByUrl('');
    });
  }

  private break() {
    console.log('Break!');
    this.openDialog('break', BreakComponent,  {
      disableClose: true,
      data: {
        escapeCombo: this.settings.escapeCombo
      }
    },
    () => {
      this.runTrial();
    });
  }

  @HostListener('document:keydown', ['$event'])
  keydown(event: KeyboardEvent) {
    this.handleKeyboardEvents(event);
  }

  handleKeyboardEvents(event: KeyboardEvent) {
    const key = event.which || event.keyCode;
    switch (event.type) {
      case 'keydown':

        this.keyboardBuffer.push(event.key);
        setTimeout(() => this.keyboardBuffer = [], 1000);
        if (this.keyboardBuffer.join('|').toLocaleLowerCase() === this.settings.escapeCombo.toLocaleLowerCase()) {
            this.abort = true;
            this.closeDialog();
            return this.router.navigateByUrl('');
        }
        break;
      default:
    }
    return false;
  }

  ngOnInit() {
    this.settingsService.loadSettings().then(() => {
      this.settings = this.settingsService.settings;
      this.loadStimuli().then(() => {
        setTimeout(() => {
          this.openDialog('start', ReadyComponent,  {
            disableClose: true,
          },
          () => {
            this.runTask();
          });
        }, 1000);
      })
    });
  }

  openDialog(id: string, target: any, options: any, afterClose: any) {
    if (this.abort || this.finish) {
      return;
    }
    if (this.dialogRefs.hasOwnProperty(id)) {
      this.dialogRefs[id].close();
    }
    this.dialogRefs[id] = this.dialog.open(target, options);
    this.dialogRefs[id].afterClosed().subscribe(() => {
      if (this.dialogRefs.hasOwnProperty(id)) {
        delete this.dialogRefs[id];
      }
      if (!this.abort) {
        afterClose();
      }
    });
  }

  closeDialog(id?: string) {
    if (id) {
      if (this.dialogRefs.hasOwnProperty(id)) {
        this.dialogRefs[id].close();
        delete this.dialogRefs[id];
      }
    } else {
      for (const property in this.dialogRefs) {
          if (this.dialogRefs.hasOwnProperty(property)) {
          this.dialogRefs[property].close();
          delete this.dialogRefs[property];
        }
      }
    }
  }

}
