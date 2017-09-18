import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BreakComponent } from './break.component';

describe('BreakComponent', () => {
  let component: BreakComponent;
  let fixture: ComponentFixture<BreakComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BreakComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BreakComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });
});
