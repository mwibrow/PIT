import { Component, OnInit, Inject } from '@angular/core';
import { MdDialog, MdDialogRef } from '@angular/material';
import { MD_DIALOG_DATA } from '@angular/material';
@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss']
})
export class ErrorComponent implements OnInit {

  title: string = 'Ooops!';
  content: string = 'An error occured.';
  constructor(@Inject(MD_DIALOG_DATA) data: any,
    public dialogRef: MdDialogRef<ErrorComponent>) {
      if (data) {
        this.title = data.title || this.title;
        this.content = data.content || this.content;
      }
  }

  ngOnInit() {
  }

  onOk() {
    this.dialogRef.close();
  }

}
