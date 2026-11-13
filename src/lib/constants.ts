export interface DemandAnchor {
  id: string;
  name: string;
  description: string;
  locality: string;
  latitude: number;
  longitude: number;
  estimatedDailyDemand: number;
  type: 'HOSPITAL' | 'COMMERCIAL' | 'TRANSIT' | 'OFFICE';
}

export const YELAHANKA_ANCHORS: DemandAnchor[] = [
  {
    id: 'anchor-mother-dairy',
    name: 'Mother Dairy Circle & New Town 4th Phase',
    description: 'Busiest retail and dining district in Yelahanka New Town',
    locality: 'Yelahanka New Town',
    latitude: 13.0998,
    longitude: 77.5971,
    estimatedDailyDemand: 850,
    type: 'COMMERCIAL',
  },
  {
    id: 'anchor-rail-wheel',
    name: 'Rail Wheel Factory (RWF) Main Gate',
    description: 'Heavy daily commuter workforce and technical visitors',
    locality: 'Yelahanka West',
    latitude: 13.1114,
    longitude: 77.5849,
    estimatedDailyDemand: 1200,
    type: 'TRANSIT',
  },
  {
    id: 'anchor-aster-cmi',
    name: 'Aster CMI Hospital & Hebbal-Yelahanka Corridor',
    description: 'Critical patient, doctor, and visitor high-turnover parking',
    locality: 'Sahakar Nagar / Hebbal NH44',
    latitude: 13.0583,
    longitude: 77.5925,
    estimatedDailyDemand: 1400,
    type: 'HOSPITAL',
  },
  {
    id: 'anchor-rmz-galleria',
    name: 'RMZ Galleria Mall & Old Town Hub',
    description: 'Weekend shopping, multiplex cinema, and regional shoppers',
    locality: 'Yelahanka Old Town',
    latitude: 13.1046,
    longitude: 77.5928,
    estimatedDailyDemand: 950,
    type: 'COMMERCIAL',
  },
  {
    id: 'anchor-yelahanka-station',
    name: 'Yelahanka Junction Railway Station',
    description: 'Daily intercity rail commuters leaving vehicles for full days',
    locality: 'Yelahanka Station Area',
    latitude: 13.1025,
    longitude: 77.6010,
    estimatedDailyDemand: 1100,
    type: 'TRANSIT',
  },
];

export const APP_CONFIG = {
  appName: 'VPark',
  // Unified single tagline per PRD v2.2 Section 5
  brandTagline: 'Find your spot. Own your time.',
  heroSubtitle: 'Discover, compare and book verified parking spaces near your destination in Bengaluru.',
  primaryColorHex: '#0A5CFF',
  city: 'Bengaluru',
  pilotMicroMarket: 'Yelahanka Pilot Zone (3km Radius)',
  r1VerifiedListingTarget: 20,
  defaultCenter: {
    lat: 13.1007,
    lng: 77.5963,
  },
  platformFeePercent: 0.12, // 12% commission
  cgstRate: 0.09, // 9%
  sgstRate: 0.09, // 9%
  holdDurationMinutes: 10,
  staleThresholdDays: 30,
  disputeSlaHours: 4,
  otpExpiryMinutes: 5,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 30,
  demoOtp: '123456',
  legalDocVersions: {
    terms: 'v2.2-2026-11-11',
    privacy: 'v2.2-2026-11-11',
    providerTerms: 'v2.2-2026-11-11',
  },
  contactEmail: 'support@vpark.in',
  contactPhone: '+91 80 4568 2026',
};

export const PROVIDER_SITUATION_EVIDENCE: Record<
  'HOUSE_OWNER' | 'TENANT' | 'APARTMENT_RESIDENT' | 'BUSINESS_OPERATOR' | 'MANAGER',
  { label: string; docType: 'SALE_DEED' | 'TENANCY_AGREEMENT' | 'SOCIETY_NOC' | 'TRADE_LICENSE' | 'POWER_OF_ATTORNEY'; requirement: string }
> = {
  HOUSE_OWNER: {
    label: 'Owner of a house or flat',
    docType: 'SALE_DEED',
    requirement: 'Ownership proof or BBMP property tax receipt + space photo',
  },
  TENANT: {
    label: 'Tenant',
    docType: 'TENANCY_AGREEMENT',
    requirement: 'Written landlord consent to sub-let unused slot',
  },
  APARTMENT_RESIDENT: {
    label: 'Apartment resident',
    docType: 'SOCIETY_NOC',
    requirement: 'Written consent / NOC from apartment society or RWA',
  },
  BUSINESS_OPERATOR: {
    label: 'Business or commercial operator',
    docType: 'TRADE_LICENSE',
    requirement: 'Trade licence / business registration & signatory authority',
  },
  MANAGER: {
    label: 'Authorised manager',
    docType: 'POWER_OF_ATTORNEY',
    requirement: 'Written authorisation letter from property owner',
  },
};

export const CANCELLATION_POLICY_RULES = [
  {
    event: 'Driver cancels 2+ hours before start',
    driverOutcome: '100% full refund of parking fee',
    providerOutcome: 'Slot released with zero penalty',
  },
  {
    event: 'Driver cancels under 2 hours before start',
    driverOutcome: '50% partial refund',
    providerOutcome: 'Compensated with 50% payout',
  },
  {
    event: 'Driver No-Show',
    driverOutcome: '0% refund',
    providerOutcome: 'Paid in full less platform fee',
  },
  {
    event: 'Provider cancels',
    driverOutcome: '100% full refund + ₹100 credit on next booking',
    providerOutcome: 'Reliability score penalty; 3 strikes lead to suspension',
  },
  {
    event: 'Space unusable upon arrival',
    driverOutcome: 'Immediate 100% refund + concierge rebooking assistance',
    providerOutcome: 'Subject to admin investigation & listing suspension',
  },
];

// Money conversion helpers: Store integer paise, display INR (PRD v2.2 Section 9.2)
export function toPaise(inr: number): number {
  return Math.round(inr * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export function formatInrFromPaise(paise: number, showDecimals = false): string {
  const value = fromPaise(paise);
  return showDecimals ? `₹${value.toFixed(2)}` : `₹${Math.round(value)}`;
}
