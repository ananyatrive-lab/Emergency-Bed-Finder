
export interface UserLocation {
  lat: number;
  lng: number;
}

export interface Booking {
  id: string;
  hospitalId: string;
  patientName: string;
  contactNumber: string;
  emergencyType: string;
  timestamp: Date;
  status: 'PENDING' | 'ARRIVED' | 'CANCELLED';
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  contact: string;
  lastUpdated: Date;
  generalBeds: {
    total: number;
    available: number;
  };
  icuBeds: {
    total: number;
    available: number;
  };
  distance: number; // Simulated or calculated distance in km
}

export enum ViewMode {
  PATIENT = 'PATIENT',
  ADMIN = 'ADMIN'
}

export interface TriageMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
