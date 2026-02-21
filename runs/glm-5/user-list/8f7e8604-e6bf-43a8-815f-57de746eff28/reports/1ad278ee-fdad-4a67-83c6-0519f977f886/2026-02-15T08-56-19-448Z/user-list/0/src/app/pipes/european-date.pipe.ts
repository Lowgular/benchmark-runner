import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'europeanDate',
})
export class EuropeanDatePipe implements PipeTransform {
  transform(value: number): string {
    const milliseconds = value < 10000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  }
}
