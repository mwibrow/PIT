import { Injectable } from '@angular/core';

import * as fs from 'fs-extra';

const storage = require('electron-json-storage');
const path = require('path');

const filterImg = item => /[.](svg|jpg|jpeg|png)/.test(path.extname(item))
const filterWav = item => /[.](wav)/.test(path.extname(item))

export const notSet = 'Not set!';

export class Settings {

    participantId: string = notSet;
    stimuliPathAudio: string = notSet;
    stimuliPathImage: string = notSet;
    responsesPath: string = notSet;
    blockSize = 10;
    responseLength = 60;
    repetitions = 3;
    escapeCombo = 'Escape|Escape|Escape';

}

function getBase(filePath): string {
  const isWindows: boolean = path.sep === '//';
  const pathApi = isWindows ? path.win32 : path;
  return pathApi.basename(filePath, path.extname(filePath))
}

@Injectable()
export class SettingsService {

  settings: Settings;

  constructor() {

    this.loadSettings();
  }

  loadSettings() {
    return new Promise((resolve, reject) => {
      this.settings = new Settings();
      storage.get('settings',
        (error, data) => {
          if (error) {
            reject(error);
          } else {
            const settings: any = data || {};
            let setting: any;
            for (setting in settings) {
              if (settings.hasOwnProperty(setting)) {
                this.settings[setting] = settings[setting];
              }
            }
            resolve();
          }
      });
    });
  }

  saveSettings() {
    return new Promise((resolve, reject) => {
      storage.set('settings', this.settings, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }


  validateSettings() {
      return new Promise((resolve, reject) => {
        let stimuli: any;
        // Check audio folder
        if (!this.settings.stimuliPathAudio || this.settings.stimuliPathAudio === notSet) {
          reject('Audio stimuli folder not set');
        }
        if (!fs.pathExistsSync(this.settings.stimuliPathAudio)) {
          reject('Audio stimuli folder does not exist')
        }
        stimuli = fs.readdirSync(this.settings.stimuliPathAudio).filter(filterWav);
        if (stimuli.length === 0) {
          reject('No Wav files in audio stimuli folder');
        }
        stimuli.filter(stimulus => {
          if (!getBase(stimulus).match(/[a-z0-9]+-[a-z0-9]+/)) {
            reject(`Audio file named incorrectly: ${stimulus}`);
          }
        });
        const words: Set<string> = new Set<string>(stimuli.map(stimulus => getBase(stimulus).split('-')[0]))
        // Check image folder
        if (!this.settings.stimuliPathImage || this.settings.stimuliPathImage === notSet) {
          reject('Image stimuli folder not set');
        }
        if (!fs.pathExistsSync(this.settings.stimuliPathImage)) {
          reject('Image stimuli folder does not exist')
        }
        stimuli = fs.readdirSync(this.settings.stimuliPathImage).filter(filterImg);
        if (stimuli.length === 0) {
          reject('No Image files in stimuli folder');
        }
        stimuli.filter(stimulus => {
          if (!getBase(stimulus).match(/[a-z0-9]+/)) {
            reject(`Image file named incorrectly: ${stimulus}`);
          }
        });
        const images: Set<string> =  new Set<string>(stimuli.map(stimulus => getBase(stimulus)));
        const difference = Array.from(words.values()).filter(word => !images.has(word));
        if (difference.length) {
          reject(`No image file for word '${difference[0]}'`);
        }
        // Check respones folder
        if (!this.settings.responsesPath || this.settings.responsesPath === notSet) {
          reject('Responses folder not set');
        }
        try {
          fs.accessSync(this.settings.responsesPath, fs.constants.W_OK);
        } catch (err) {
          reject('Cannot write to Responses folder');
        }
        resolve();
      });
    }

}


interface Setting<T> {
  value: T;
  defaultValue: T;

  validate(): Promise<void>;
  validateRegex(): boolean;

  setValue(value: T);
  getValue(): T;

}

class FolderSetting implements Setting<string> {

  value: string;
  defaultValue: string;
  // tslint:disable-next-line
  permissions: any = fs.constants.W_OK | fs.constants.R_OK;

  validate(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        fs.accessSync(this.value, this.permissions);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  validateRegex() {
    return true;
  }

  setValue(value: string) {
    this.value = value;
  }

  getValue() {
    return this.value;
  }
}

class NumberSetting implements Setting<number> {

  value: number;
  defaultValue: number;
  min: number;
  max: number;

  // tslint:disable-next-line
  permissions: any = fs.constants.W_OK | fs.constants.R_OK;

  constructor(defaultValue: number, min: number, max: number) {
    this.value = this.defaultValue = defaultValue;
    this.min = min;
    this.max = max;
  }

  validate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.value >= this.min && this.value <= this.max) {
        resolve();
      }
      reject();
    });
  }

  validateRegex(): boolean {
    return this.value.toString().match(/\d+/).length > 0;
  }

  setValue(value: number) {
    this.value = value;
  }

  getValue() {
    return this.value;
  }
}
