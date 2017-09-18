import { Component, OnInit } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-break',
  templateUrl: './break.component.html',
  styleUrls: ['./break.component.scss'],
  host: {
    '(document:keydown)': 'handleKeyboardEvents($event)',
    '(document:keyup)': 'handleKeyboardEvents($event)'
  }
})
export class BreakComponent implements OnInit {

  constructor(private dialogRef: MdDialogRef<BreakComponent>) { }

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
