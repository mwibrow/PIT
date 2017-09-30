import { Component, OnInit } from '@angular/core';
import { MdDialog, MdDialogRef } from '@angular/material';
import { Router } from '@angular/router'
import { ErrorComponent } from '../error/error.component';

import { SettingsService, Settings, notSet } from '../../providers/settings.service';

const {dialog} = require('electron').remote;
const fs = require('fs-extra');
const klawSync = require('klaw-sync')
const path = require('path');

const filterImg = item => /[.](jpg|jpeg|png)/.test(path.extname(item.path))
const filterWav = item => /[.]wav/.test(path.extname(item.path))

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  public settings: Settings;
  public stimuliPathAudioValidationMessage: string ='';
  public stimuliPathImageValidationMessage: string ='';
  public responsesPathValidationMessage: string ='';

  constructor(
      private router: Router,
      private dialog: MdDialog,
      private dialogRef: MdDialogRef<SettingsComponent>,
      private settingsService: SettingsService) {

      this.settings = settingsService.settings;
  }

  ngOnInit() {
  }

  changeStimuliPathAudio() {
    let path: any = dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.stimuliPathAudio
    });
    if (path && path.length === 1) {
      this.settings.stimuliPathAudio = path[0];
      this.validateStimuliPathAudio();

    }
  }

  changeStimuliPathImage() {
    let path: any = dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.stimuliPathImage
    });
    if (path && path.length === 1) {
      this.settings.stimuliPathImage = path[0];
      this.validateStimuliPathImage();

    }
  }

  changeResponsesPath() {
    let path: any = dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.responsesPath
    });
    if (path && path.length === 1) {
      this.settings.responsesPath = path[0];
      this.validateResponsesPath();
    }
  }

  cancelSettings() {
    this.dialogRef.close();
  }


  saveSettings() {
    this.settingsService.saveSettings()
      .then(() => { this.dialogRef.close(); })
      .catch((error) => {
        console.error(error)
        this.dialog.open(ErrorComponent, {
          data: {
            title: 'Ooops!',
            content: 'Settings could not be saved.'
          }
        })
      });
  }

  validateSettings() {
    this.validateStimuliPathAudio();
    this.validateStimuliPathImage();
    this.validateResponsesPath();
    return this.responsesPathValidationMessage === '' && this.stimuliPathAudioValidationMessage === '' && this.stimuliPathImageValidationMessage === '';
  }

  changeBlockSize(by: number) {
    if (by) {
      this.settings.blockSize += by;
    }
    if (this.settings.blockSize < 1) this.settings.blockSize = 1;
    if (this.settings.blockSize > 100) this.settings.blockSize = 100;
  }

  changeResponseLength(by: number) {
    if (by) {
      this.settings.responseLength += by;
    }
    if (this.settings.responseLength < 1) this.settings.responseLength = 1;
    if (this.settings.responseLength > 10) this.settings.responseLength = 10;
  }

  validateStimuliPathAudio() {
    if (!this.settings.stimuliPathAudio || this.settings.stimuliPathAudio === notSet) {
      this.stimuliPathAudioValidationMessage = 'Audio stimuli folder not set';
      return;
    }
    if (!fs.pathExistsSync(this.settings.stimuliPathAudio)) {
      this.stimuliPathAudioValidationMessage = 'Audio stimuli folder does not exist';
      return;
    }
    let stimuli = klawSync(this.settings.stimuliPathAudio, { filter: filterWav });
    if (stimuli.length === 0) {
      this.stimuliPathAudioValidationMessage = 'No WAV files in audio stimuli folder';
      return;
    }
    this.stimuliPathAudioValidationMessage = '';
  }

  validateStimuliPathImage() {
    if (!this.settings.stimuliPathImage || this.settings.stimuliPathImage === notSet) {
      this.stimuliPathImageValidationMessage = 'Image stimuli folder not set';
      return;
    }
    if (!fs.pathExistsSync(this.settings.stimuliPathImage)) {
      this.stimuliPathImageValidationMessage = 'Image stimuli folder does not exist';
      return;
    }
    let stimuli = klawSync(this.settings.stimuliPathImage, { filter: filterImg });
    if (stimuli.length === 0) {
      this.stimuliPathImageValidationMessage = 'No image files in stimuli folder';
      return;
    }
    this.stimuliPathImageValidationMessage = '';
  }

  validateResponsesPath() {
    if (!this.settings.responsesPath || this.settings.responsesPath === notSet) {
      this.responsesPathValidationMessage = 'Responses folder not set';
      return;
    }
    try {
      fs.accessSync(this.settings.responsesPath, fs.W_OK);
    } catch (err) {
      this.responsesPathValidationMessage = 'Cannot write to Responses folder';
      return;
    }
    this.responsesPathValidationMessage = '';
  }

}


const validateSettings = (settings: any)  => {

  return new Promise((resolve, reject) => {
    if (!settings.stimuliPath || settings.responsesPath === notSet) {
      reject('Stimuli folder not set');
    }
    if (!fs.pathExistsSync(settings.stimuliPath)) {
      reject('Stimuli folder does not exist')
    }
    let stimuli = klawSync(settings.stimuliPath, { filter: filterImg });
    if (stimuli.length === 0) {
      reject('No image files in stimuli folder');
    }
    if (!settings.responsesPath || settings.responsesPath === notSet) {
      reject('Responses folder not set');
    }
    try {
      fs.accessSync(settings.responsesPath, fs.W_OK);
    } catch (err) {
      reject('Cannot write to Responses folder');
    }
    resolve();
  });
}
