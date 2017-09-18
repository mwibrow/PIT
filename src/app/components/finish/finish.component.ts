import { Component, OnInit } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-finish',
  templateUrl: './finish.component.html',
  styleUrls: ['./finish.component.scss'],
  host: {
    '(document:keydown)': 'handleKeyboardEvents($event)',
    '(document:keyup)': 'handleKeyboardEvents($event)'
  }
})
export class FinishComponent implements OnInit {

  constructor(private dialogRef: MdDialogRef<FinishComponent>) { }

  ngOnInit() {
  }

  handleKeyboardEvents(event: KeyboardEvent) {
    switch (event.type) {
      case 'keydown':
          if (event.keyCode === 32) {
            this.dialogRef.close();
          }
      default:
    }
  }
}
