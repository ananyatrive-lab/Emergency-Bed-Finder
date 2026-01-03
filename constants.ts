
import { Hospital } from './types';

const now = new Date();

export const INITIAL_HOSPITALS: Hospital[] = [
  {
    id: 'h1',
    name: 'Sanjay Gandhi Postgraduate Institute (SGPGI)',
    address: 'Raebareli Rd, Lucknow, Uttar Pradesh',
    lat: 26.7431,
    lng: 80.9385,
    contact: '0522 266 8700',
    lastUpdated: new Date(now.getTime() - 1000 * 60 * 5),
    generalBeds: { total: 200, available: 15 },
    icuBeds: { total: 50, available: 4 },
    distance: 0
  },
  {
    id: 'h2',
    name: 'King George\'s Medical University (KGMU)',
    address: 'Shah Mina Rd, Chowk, Lucknow',
    lat: 26.8687,
    lng: 80.9168,
    contact: '0522 225 7450',
    lastUpdated: new Date(now.getTime() - 1000 * 60 * 12),
    generalBeds: { total: 500, available: 0 },
    icuBeds: { total: 100, available: 2 },
    distance: 0
  },
  {
    id: 'h3',
    name: 'Medanta Hospital Lucknow',
    address: 'Sector A, Pocket 1, Sushant Golf City',
    lat: 26.7725,
    lng: 81.0028,
    contact: '0522 450 5050',
    lastUpdated: new Date(now.getTime() - 1000 * 60 * 2),
    generalBeds: { total: 300, available: 85 },
    icuBeds: { total: 80, available: 12 },
    distance: 0
  },
  {
    id: 'h4',
    name: 'Apollomedics Super Speciality Hospital',
    address: 'Kanpur - Lucknow Rd, Sector B, Bargawan',
    lat: 26.7871,
    lng: 80.8926,
    contact: '0522 678 8888',
    lastUpdated: new Date(now.getTime() - 1000 * 60 * 30),
    generalBeds: { total: 150, available: 8 },
    icuBeds: { total: 35, available: 1 },
    distance: 0
  },
  {
    id: 'h5',
    name: 'Ram Manohar Lohia Institute (RMLIMS)',
    address: 'Vibhuti Khand, Gomti Nagar, Lucknow',
    lat: 26.8624,
    lng: 81.0020,
    contact: '0522 669 2000',
    lastUpdated: new Date(now.getTime() - 1000 * 60 * 8),
    generalBeds: { total: 250, available: 5 },
    icuBeds: { total: 40, available: 0 },
    distance: 0
  }
];

export const COLORS = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
  none: 'bg-slate-400'
};
