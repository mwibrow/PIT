import { Component, OnInit } from '@angular/core';
import { AudioService, AudioPlayer, AudioRecorder } from '../../providers/audio.service';
import { Router } from '@angular/router';
import { MdDialog, MdDialogRef } from '@angular/material';

const sprintf = require ('sprintf-js');

const storage = require('electron-json-storage');
const fs = require('fs-extra');
const klawSync = require('klaw-sync')
const log = require('log')
const path = require('path');
var _ = require('lodash');

import { ErrorComponent } from '../error/error.component';
import { FinishComponent } from '../finish/finish.component';
import { ReadyComponent } from '../ready/ready.component';
import { BreakComponent } from '../break/break.component';
import { SettingsService, Settings } from '../../providers/settings.service';

const filterImg = item => /[.](jpg|jpeg|png)/.test(path.extname(item.path))
const filterWav = item => /[.]wav/.test(path.extname(item.path))

const COLOR_COUNT: number = 16;
const DIRECTIONS: Array<string> =  ['top', 'bottom', 'left', 'right'];
const STYLE_OUT: string = 'out';
const STYLE_IN: string = 'in';


class Tile {
  constructor(
    public color: number,
    public stack: string,
    public direction: string,
    public style: string,
    public imageSrc: Array<String>,
    public active: boolean=false) { };


}

@Component({
  selector: 'app-task',
  templateUrl: './task.component.html',
  styleUrls: ['./task.component.scss'],
  host: {
    '(document:keydown)': 'handleKeyboardEvents($event)',
    '(document:keyup)': 'handleKeyboardEvents($event)'
  }
})
export class TaskComponent implements OnInit {

  private settings: Settings;
  private stimuli: Array<any>;

  private audioStimuli: any;
  private imageStimuli: any;

  private trial: number;
  private participantFolder: string;
  private now: Date;
  private target: string;

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
    this.tiles.push(new Tile(0, 'back', 'top', 'out', null));
    this.tiles.push(new Tile(0, 'front', 'left', 'in', null));
    this.incomingTileIndex = 0;
    this.savedTileColor = null;
    this.log = null;

  }

  private loadStimuli() {
    return new Promise((resolve, reject) => {
      this.loadAudioStimuli().then(() => this.loadImageStimuli()).then(() => resolve())
    });
  }

  private loadAudioStimuli() {
    return new Promise((resolve, reject) => {
      console.log(`Loading wav files from ${this.settings.stimuliPathAudio}`);
      let stimuli = klawSync(this.settings.stimuliPathAudio, { filter: filterWav });
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
      this.audioStimuli = stimuli.reduce((obj, stimulus) => Object.assign(obj, {[this.getBase(stimulus.path)]: stimulus.path}), {})
      this.stimuli = Object.keys(this.audioStimuli);
      if (this.settings.repetitions > 1) {
        this.stimuli = _.flatten(_.times(this.settings.repetitions, () => this.stimuli));
      }
      console.log(`Total audio stimuli (including repetitions): ${this.stimuli.length}`)
      resolve();
    });
  }

  private loadImageStimuli() {
    return new Promise((resolve, reject) => {
      console.log(`Loading wav files from ${this.settings.stimuliPathImage}`);
      let stimuli = klawSync(this.settings.stimuliPathImage, { filter: filterImg });
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
      this.imageStimuli = stimuli.reduce((obj, stimulus) => Object.assign(obj, {[this.getBase(stimulus.path)]: stimulus.path}), {})
      resolve();
    });
  }

  private getBase(filePath): string {
    let isWindows: boolean = path.sep === '//';
    let pathApi = isWindows ? path.win32 : path;
    return pathApi.basename(filePath, path.extname(filePath))
  }

  private getDistractors(target: string): Array<string> {
    return _.sampleSize(_.filter(this.stimuli, (stimulus) => stimulus !== target), 2);
  }

  private runTask() {
    let now = new Date();
    this.participantFolder = sprintf.sprintf('%04d%02d%02d-%02d%02d%02d',
      now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    let participantPath = path.normalize(path.join(this.settings.responsesPath, this.participantFolder));
    fs.mkdirpSync(participantPath,
      (err) => {
        console.error(`Could not create folder '${participantPath}'`)
      });
    this.log = fs.createWriteStream(path.join(participantPath, 'results.txt'))
    this.writeRow('trial', ['image1', 'image2', 'image3'], 'target', 'response')
    this.stimuli = _.shuffle(this.stimuli);
    this.finish = false;
    this.abort = false;
    this.taskRunning = true;
    this.runTrial();
  }

  private writeRow(trial, images, target, response) {
    let row = sprintf.sprintf('%10s %10s %10s %10s %10s %10s\n',
      (trial).toString(), images[0], images[1], images[2], target, response)
    this.log.write(row)
  }

  private cleanUp() {
    if (this.log) {
      this.log.close();
    }
  }

  private runTrial() {
    this.startTrial()
      .then(() => this.setUpTrial())
  }

  private startTrial() {
    this.trialRunning = true;
    return new Promise((resolve, reject) => {


      resolve();
    });
  }

  private setUpTrial() {
    let i: number;
    return new Promise((resolve, reject) => {
      i = this.trial % this.stimuli.length;
      this.target = this.stimuli[i]
      let imageStimuli = _.shuffle(_.sampleSize(
          Object.keys(this.imageStimuli).filter(image => image !== this.target), 2).concat([this.target]))
      this.updateTiles(imageStimuli.map(image => this.imageStimuli[image]))
      setTimeout(() => resolve(), 2000);
    });
  }

  private recordResponse()  {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(), this.settings.responseLength * 1000);
    })
  }

  private saveResponse() {
    return new Promise((resolve, reject) => {

    });
  }

  private getResponseFile() {
    let i: number;
    i = this.trial % this.stimuli.length;
    return path.normalize(path.join(
      this.settings.responsesPath, this.participantFolder,
      `${sprintf.sprintf('%03d', this.trial + 1)}-${path.posix.basename(this.stimuli[i].path, path.extname(this.stimuli[i].path))}.wav`
    ));
  }

  private endTrial() {
    this.trial ++;
    if (this.abort) {
      return;
    }
    if (this.trial >= this.stimuli.length) {
      this.updateTiles(null);
      setTimeout(() => this.endTask(), 2000);
    } else {
      if (this.trial % this.settings.blockSize === 0) {
        this.updateTiles(null);
        setTimeout(() => this.break(), 1500);
      } else {
        this.runTrial();
      }
    }
  }

  private updateTiles(imageSrc?: Array<string>) {
    console.log(imageSrc)
    let newColor: number;
    let i = this.trial % this.stimuli.length;
    let outgoingTileIndex: number = this.incomingTileIndex;
    this.incomingTileIndex = 1 - this.incomingTileIndex;

    let inTile = this.tiles[this.incomingTileIndex];
    let outTile = this.tiles[1 - this.incomingTileIndex];
    let directions = _.sampleSize(DIRECTIONS, 2);


    inTile.imageSrc = imageSrc;
    inTile.color = _.sample(_.range(COLOR_COUNT).filter(count => count = outTile.color));
    inTile.style = STYLE_IN;
    inTile.direction = directions[0];

    outTile.style = STYLE_OUT;
    outTile.direction = directions[1];
    inTile.active = true;
    setTimeout(() => this.tiles[outgoingTileIndex].imageSrc = null, 2000);
  }

  private loadImageSrc(imageSrc: Array<string>) {
    return this._loadImageSrc(imageSrc, []);
  }

  private _loadImageSrc(imageSrc: Array<string>, imageBuf: Array<string>) {
    if (imageSrc.length === 0) {

    }
    return new Promise((resolve, reject) => {

      fs.readFile(imageSrc, (err, buffer) => {

      })
    });
  }

  public getImageSrc(imageSrc:string) {
    return `data:image/png;base64,${imageSrc}`
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
    this.openDialog('break', BreakComponent,  {
      disableClose: true
    },
    () => {
      this.runTrial();
    });
  }

  handleKeyboardEvents(event: KeyboardEvent) {
    let key = event.which || event.keyCode;
    switch (event.type) {
      case 'keydown':
        this.keyboardBuffer.push(event.key);

        if (this.keyboardBuffer.join('|') === 'Control|Shift|Escape') {
            this.abort = true;
            this.closeDialog();
            this.router.navigateByUrl('');
        }
        break;
      case 'keyup':
          this.keyboardBuffer = [];
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
    if (this.abort || this.finish) return;
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
      for (let id in this.dialogRefs) {
          if (this.dialogRefs.hasOwnProperty(id)) {
          this.dialogRefs[id].close();
          delete this.dialogRefs[id];
        }
      }
    }
  }

}
