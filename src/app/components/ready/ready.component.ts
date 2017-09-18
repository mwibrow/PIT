import { Component, OnInit } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-ready',
  templateUrl: './ready.component.html',
  styleUrls: ['./ready.component.scss'],
  host: {
    '(document:keydown)': 'handleKeyboardEvents($event)',
    '(document:keyup)': 'handleKeyboardEvents($event)'
  }
})
export class ReadyComponent implements OnInit {

  constructor(private dialogRef: MdDialogRef<ReadyComponent>) { }

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
