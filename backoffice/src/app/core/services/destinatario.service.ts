import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Destinatario } from '../models/tramite.model';

@Injectable({ providedIn: 'root' })
export class DestinatarioService {
  private readonly apiUrl = `${environment.apiUrl}/destinatarios`;

  private destinatarios$ = this.http.get<Destinatario[]>(this.apiUrl).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor(private http: HttpClient) {}

  getAll(): Observable<Destinatario[]> {
    return this.destinatarios$;
  }
}
