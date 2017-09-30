import { Injectable } from '@angular/core';

const fs = require('fs-extra');
const storage = require('electron-json-storage');
const klawSync = require('klaw-sync')
const path = require('path');

const filterImg = item => /[.](svg|jpg|jpeg|png)/.test(path.extname(item.path))
const filterWav = item => /[.](wav)/.test(path.extname(item.path))

export const notSet: string = 'Not set!';

export class Settings {

    participantId: string = notSet;
    stimuliPathAudio: string = notSet;
    stimuliPathImage: string = notSet;
    responsesPath: string = notSet;
    blockSize: number = 10;
    responseLength: number = 60;
    repetitions: number = 3;
    escapeCombo: string = 'Escape|Escape|Escape';

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
            let settings: any = data || {}, setting: any;
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
        stimuli = klawSync(this.settings.stimuliPathAudio, { filter: filterWav });
        if (stimuli.length === 0) {
          reject('No Wav files in audio stimuli folder');
        }
        // Check image folder
        if (!this.settings.stimuliPathImage || this.settings.stimuliPathImage === notSet) {
          reject('Image stimuli folder not set');
        }
        if (!fs.pathExistsSync(this.settings.stimuliPathImage)) {
          reject('Image stimuli folder does not exist')
        }
        stimuli = klawSync(this.settings.stimuliPathImage, { filter: filterImg });
        if (stimuli.length === 0) {
          reject('No Image files in stimuli folder');
        }
        // Check respones folder
        if (!this.settings.responsesPath || this.settings.responsesPath === notSet) {
          reject('Responses folder not set');
        }
        try {
          fs.accessSync(this.settings.responsesPath, fs.W_OK);
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
  permissions: any = fs.W_OK | fs.R_OK;

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

  permissions: any = fs.W_OK | fs.R_OK;

  constructor(defaultValue: number, min: number, max:number) {
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