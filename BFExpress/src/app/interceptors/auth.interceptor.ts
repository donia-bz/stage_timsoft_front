import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add JWT token from localStorage
    const token = localStorage.getItem('currentUser');
    if (token) {
      const authReq = request.clone({
        setHeaders: {
          Authorization: `Bearer ${JSON.parse(token).token}`
        }
      });
      return next.handle(authReq).pipe(catchError(this.handleError));
    }

    return next.handle(request).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }

    let errorMessage = 'Une erreur est survenue';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Erreur serveur: ${error.status}`;
    }

    return throwError(() => errorMessage);
  }
}
