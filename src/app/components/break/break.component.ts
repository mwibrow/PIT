import { Component, OnInit, Inject } from '@angular/core';
import { MdDialogRef, MD_DIALOG_DATA } from '@angular/material';
import { Router } from '@angular/router';

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

  private keyboardBuffer: Array<string>;
  private escapeCombo: string = 'Escape';
  constructor(@Inject(MD_DIALOG_DATA) data: any,
      private dialogRef: MdDialogRef<BreakComponent>,
      private router: Router) {

    this.keyboardBuffer = new Array<string>();
    this.escapeCombo = data && data.escapeCombo ? data.escapeCombo : this.escapeCombo;

  }

  ngOnInit() {
  }

  handleKeyboardEvents(event: KeyboardEvent) {
    let key = event.which || event.keyCode;
    switch (event.type) {
      case 'keydown':
        if (event.keyCode === 32) {
          return this.dialogRef.close();
        }
        this.keyboardBuffer.push(event.key);
        setTimeout(() => this.keyboardBuffer = [], 1000)
        if (this.keyboardBuffer.join('|') === this.escapeCombo) {
            this.dialogRef.close();
            this.router.navigateByUrl('');
        }
        break;
      default:
    }
    return false;
  }
}
