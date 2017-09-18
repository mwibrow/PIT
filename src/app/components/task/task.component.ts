import { Component, OnInit } from '@angular/core';
import { AudioService, AudioPlayer, AudioRecorder } from '../../providers/audio.service';
import { Router } from '@angular/router';
import { MdDialog, MdDialogRef } from '@angular/material';

const sprintf = require ('sprintf-js');

const storage = require('electron-json-storage');
const fs = require('fs-extra');
const klawSync = require('klaw-sync')
const path = require('path');
var _ = require('lodash');

import { ErrorComponent } from '../error/error.component';
import { FinishComponent } from '../finish/finish.component';
import { ReadyComponent } from '../ready/ready.component';
import { BreakComponent } from '../break/break.component';
import { SettingsService, Settings } from '../../providers/settings.service';

const filterImg = item => /[.](svg|jpg|jpeg|png)/.test(path.extname(item.path))

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
    public imageSrc: string) {};
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
  private trial: number;
  private participantFolder: string;
  private now: Date;

  private recorder: AudioRecorder;

  private keyboardBuffer: Array<string>;

  private dialogRefs: any;

  private finish: boolean;
  private abort: boolean;

  private taskRunning: boolean;
  private trialRunning: boolean;

  public tiles: Array<Tile>;
  private incomingTileIndex: number;
  private savedTileColor: number;

  private imageSrc: string;
  constructor(
      private router: Router,
      private audio: AudioService,
      public dialog: MdDialog,
      public settingsService: SettingsService) {

    this.audio.initialise();
    this.recorder = audio.recorder;
    this.recorder.initialise();

    this.keyboardBuffer = [];


    this.stimuli = new Array<any>();
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

    this.imageSrc = null;
  }


  private loadStimuli() {
    return new Promise((resolve, reject) => {
      console.log(`Loading wav files from ${this.settings.stimuliPath}`);
      this.stimuli = klawSync(this.settings.stimuliPath, { filter: filterImg });
      if (this.stimuli.length === 0) {
        this.openDialog('error', ErrorComponent, {
          data: {
            title: 'Ooops!',
            content: 'There were no image files in the stimuli folder'
          }
        },
        () => {
            this.router.navigateByUrl('');
          });
      }
      console.log(`Loaded ${this.stimuli.length} paths.`);
      resolve();
    });
  }

  private runTask() {
    let now = new Date();
    this.participantFolder = sprintf.sprintf('%04d%02d%02d-%02d%02d',
      now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes());
    let participantPath = path.normalize(path.join(this.settings.responsesPath, this.participantFolder));
    fs.mkdirpSync(participantPath,
      (err) => {
        console.error(`Could not create folder '${participantPath}'`)
      });
    this.stimuli = _.shuffle(this.stimuli);
    this.finish = false;
    this.abort = false;
    this.taskRunning = true;
    this.runTrial();
  }

  private runTrial() {
    this.startTrial()
      .then(() => this.loadStimulus())
      .then(() => this.recordResponse())
      .then(() => this.saveResponse())
      .then(() => this.endTrial());
  }

  private startTrial() {
    this.trialRunning = true;
    return new Promise((resolve, reject) => {
      this.recorder.record();
      resolve();
    });
  }

  private loadStimulus()  {
    let i: number;
    return new Promise((resolve, reject) => {
      i = this.trial % this.stimuli.length;
      this.updateTiles(this.stimuli[i].path);
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
      this.recorder.stop().then(() => {
        let wavPath: string = this.getResponseFile();
        console.log(`Saving wav to ${wavPath}`);
        this.recorder.saveWav(wavPath).then(() => resolve());
      });
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

  private updateTiles(imageSrc?: string) {
    let newColor: number;
    let i = this.trial % this.stimuli.length;
    let outgoingTileIndex: number = this.incomingTileIndex;
    this.incomingTileIndex = 1 - this.incomingTileIndex;

    if (imageSrc) {
      newColor = this.savedTileColor ? this.savedTileColor : this.tiles[outgoingTileIndex].color;
      this.tiles[this.incomingTileIndex].color = (newColor % COLOR_COUNT) + 1;
      this.savedTileColor = null;
    } else {
      this.savedTileColor = this.tiles[outgoingTileIndex].color;
      this.tiles[this.incomingTileIndex].color = 0
    }
    this.tiles[this.incomingTileIndex].imageSrc = imageSrc;
    console.log(imageSrc)
    this.tiles[this.incomingTileIndex].style = STYLE_IN;
    this.tiles[outgoingTileIndex].style = STYLE_OUT;
    let directions = _.sampleSize(DIRECTIONS, 2);
    this.tiles[this.incomingTileIndex].direction = directions[0];
    this.tiles[outgoingTileIndex].direction = directions[1];
    setTimeout(() => this.tiles[outgoingTileIndex].imageSrc = null, 2000)
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
