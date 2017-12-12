import { Component, OnInit } from '@angular/core';
import { MdDialog, MdDialogRef } from '@angular/material';
import { Router } from '@angular/router'
import { ErrorComponent } from '../error/error.component';

import { SettingsService, Settings, notSet } from '../../providers/settings.service';

const electronDialog = require('electron').remote.dialog;
import * as fs from 'fs-extra';
const path = require('path');

const filterImg = item => /[.](jpg|jpeg|png)/.test(path.extname(item))
const filterWav = item => /[.]wav/.test(path.extname(item))

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  public settings: Settings;
  public stimuliPathAudioValidationMessage = '';
  public stimuliPathImageValidationMessage = '';
  public responsesPathValidationMessage = '';

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
    const stimuliPath: any = electronDialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.stimuliPathAudio
    });
    if (stimuliPath && stimuliPath.length === 1) {
      this.settings.stimuliPathAudio = stimuliPath[0];
      this.validateStimuliPathAudio();

    }
  }

  changeStimuliPathImage() {
    const stimuliPath: any = electronDialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.stimuliPathImage
    });
    if (stimuliPath && stimuliPath.length === 1) {
      this.settings.stimuliPathImage = stimuliPath[0];
      this.validateStimuliPathImage();

    }
  }

  changeResponsesPath() {
    const stimuliPath: any = electronDialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: this.settings.responsesPath
    });
    if (stimuliPath && stimuliPath.length === 1) {
      this.settings.responsesPath = stimuliPath[0];
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
    return this.responsesPathValidationMessage === '' && this.stimuliPathAudioValidationMessage === ''
      && this.stimuliPathImageValidationMessage === '';
  }

  changeBlockSize(by: number) {
    if (by) {
      this.settings.blockSize += by;
    }
    if (this.settings.blockSize < 1) {
      this.settings.blockSize = 1;
    }
    if (this.settings.blockSize > 100) {
      this.settings.blockSize = 100;
    }
  }

  changeRepetitions(by: number) {
    if (by) {
      this.settings.repetitions += by;
    }
    if (this.settings.repetitions < 1) {
      this.settings.repetitions = 1;
    }
    if (this.settings.repetitions > 10) {
      this.settings.repetitions = 10;
    }
  }

  toggleStratifiedSampling() {
    this.settings.stratifiedSampling = !this.settings.stratifiedSampling
    console.log('target')
  }

  changeResponseLength(by: number) {
    if (by) {
      this.settings.responseLength += by;
    }
    if (this.settings.responseLength < 1) {
      this.settings.responseLength = 1;
    }
    if (this.settings.responseLength > 10) {
      this.settings.responseLength = 10;
    }
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
    const stimuli = fs.readdirSync(this.settings.stimuliPathAudio).filter(filterWav);
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
    const stimuli = fs.readdirSync(this.settings.stimuliPathImage).filter(filterImg);
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
      fs.accessSync(this.settings.responsesPath, fs.constants.W_OK);
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
    const stimuli =  fs.readdirSync(settings.stimuliPath).filter(filterImg);
    if (stimuli.length === 0) {
      reject('No image files in stimuli folder');
    }
    if (!settings.responsesPath || settings.responsesPath === notSet) {
      reject('Responses folder not set');
    }
    try {
      fs.accessSync(settings.responsesPath, fs.constants.W_OK);
    } catch (err) {
      reject('Cannot write to Responses folder');
    }
    resolve();
  });
}
