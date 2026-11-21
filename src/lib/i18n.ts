export type Language = 'en' | 'kn' | 'hi';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  subtitle: string;
  findParking: string;
  listSpace: string;
  howItWorks: string;
  logIn: string;
  myBookings: string;
  monthlyPasses: string;
  providerHub: string;
  adminConsole: string;
  rentSpaceTitle: string;
  rentSpaceDesc: string;
  rentSpaceCta: string;
  getParkingTitle: string;
  getParkingDesc: string;
  getParkingCta: string;
  searchPlaceholder: string;
  useLocation: string;
  radius: string;
  sort: string;
  bestMatch: string;
  lowestPrice: string;
  nearest: string;
  highestRated: string;
  privateParking: string;
  commercialParking: string;
  publicParking: string;
  reserveSpot: string;
  navigate: string;
  slotsFree: string;
  perHour: string;
  checkInNow: string;
  checkOutNow: string;
  verifiedBadge: string;
  staleBadge: string;
  evReady: string;
  covered: string;
  inspectFormula: string;
  pilotZone: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    appName: 'VPark',
    tagline: 'Find your spot. Own your time.',
    subtitle: 'Discover, compare and book verified parking spaces near your destination.',
    findParking: 'Find Parking',
    listSpace: 'List Your Space',
    howItWorks: 'How it works',
    logIn: 'Log in',
    myBookings: 'My Bookings',
    monthlyPasses: 'Monthly Passes',
    providerHub: 'Host Dashboard',
    adminConsole: 'Admin Console',
    rentSpaceTitle: 'Rent your space',
    rentSpaceDesc: 'Turn your unused residential or commercial parking space into steady income.',
    rentSpaceCta: 'Get started',
    getParkingTitle: 'Get parking',
    getParkingDesc: 'Find verified, convenient parking around your destination in Bengaluru.',
    getParkingCta: 'Find parking',
    searchPlaceholder: 'Search hospital, market, station in Yelahanka...',
    useLocation: 'Use Current Location',
    radius: 'Radius',
    sort: 'Sort',
    bestMatch: 'Best Match',
    lowestPrice: 'Lowest Price',
    nearest: 'Nearest Distance',
    highestRated: 'Highest Rated',
    privateParking: 'Private (Verified)',
    commercialParking: 'Commercial Reserved',
    publicParking: 'Public (Discovery)',
    reserveSpot: 'Book Now',
    navigate: 'Navigate',
    slotsFree: 'slots available',
    perHour: '/hr',
    checkInNow: 'I Have Arrived · Check In',
    checkOutNow: 'I Am Leaving · Check Out',
    verifiedBadge: 'Verified',
    staleBadge: 'Unconfirmed >30d',
    evReady: 'EV Ready',
    covered: 'Covered',
    inspectFormula: 'Inspect Ranking Formula',
    pilotZone: 'Yelahanka Pilot Active',
  },
  kn: {
    appName: 'ವಿಪಾರ್ಕ್',
    tagline: 'ನಿಮ್ಮ ಸ್ಥಳ ಹುಡುಕಿ. ನಿಮ್ಮ ಸಮಯ ಉಳಿಸಿ.',
    subtitle: 'ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನದ ಹತ್ತಿರ ಪರಿಶೀಲಿಸಿದ ಪಾರ್ಕಿಂಗ್ ಸ್ಥಳಗಳನ್ನು ಹುಡುಕಿ ಮತ್ತು ಕಾಯ್ದಿರಿಸಿ.',
    findParking: 'ಪಾರ್ಕಿಂಗ್ ಹುಡುಕಿ',
    listSpace: 'ಸ್ಥಳ ನೀಡಿ',
    howItWorks: 'ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
    logIn: 'ಲಾಗಿನ್',
    myBookings: 'ನನ್ನ ಬುಕಿಂಗ್‌ಗಳು',
    monthlyPasses: 'ಮಾಸಿಕ ಪಾಸ್‌ಗಳು',
    providerHub: 'ಹೋಸ್ಟ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    adminConsole: 'ನಿರ್ವಾಹಕ ಕನ್ಸೋಲ್',
    rentSpaceTitle: 'ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಬಾಡಿಗೆಗೆ ನೀಡಿ',
    rentSpaceDesc: 'ಬಳಸದ ಮನೆ ಅಥವಾ ವಾಣಿಜ್ಯ ಪಾರ್ಕಿಂಗ್ ಸ್ಥಳದಿಂದ ಆದಾಯ ಗಳಿಸಿ.',
    rentSpaceCta: 'ಪ್ರಾರಂಭಿಸಿ',
    getParkingTitle: 'ಪಾರ್ಕಿಂಗ್ ಪಡೆಯಿರಿ',
    getParkingDesc: 'ಬೆಂಗಳೂರಿನಲ್ಲಿ ನಿಮ್ಮ ಗಮ್ಯಸ್ಥಾನದ ಸುತ್ತ ಅನುಕೂಲಕರ ಪಾರ್ಕಿಂಗ್ ಹುಡುಕಿ.',
    getParkingCta: 'ಪಾರ್ಕಿಂಗ್ ಹುಡುಕಿ',
    searchPlaceholder: 'ಯಲಹಂಕದ ಆಸ್ಪತ್ರೆ, ಮಾರುಕಟ್ಟೆ, ನಿಲ್ದಾಣ ಹುಡುಕಿ...',
    useLocation: 'ಪ್ರಸ್ತುತ ಸ್ಥಳ ಬಳಸಿ',
    radius: 'ತ್ರಿಜ್ಯ',
    sort: 'ವಿಂಗಡಿಸಿ',
    bestMatch: 'ಉತ್ತಮ ಹೊಂದಾಣಿಕೆ',
    lowestPrice: 'ಕಡಿಮೆ ಬೆಲೆ',
    nearest: 'ಹತ್ತಿರದ ದೂರ',
    highestRated: 'ಹೆಚ್ಚು ರೇಟಿಂಗ್',
    privateParking: 'ಖಾಸಗಿ (ಪರಿಶೀಲಿತ)',
    commercialParking: 'ವಾಣಿಜ್ಯ ಮೀಸಲು',
    publicParking: 'ಸಾರ್ವಜನಿಕ (ಮಾಹಿತಿಗಾಗಿ)',
    reserveSpot: 'ಬುಕ್ ಮಾಡಿ',
    navigate: 'ದಾರಿ ತೋರಿಸಿ',
    slotsFree: 'ಖಾಲಿ ಜಾಗಗಳಿವೆ',
    perHour: '/ಗಂಟೆ',
    checkInNow: 'ನಾನು ಬಂದಿದ್ದೇನೆ · ಚೆಕ್ ಇನ್',
    checkOutNow: 'ಹೊರಡುತ್ತಿದ್ದೇನೆ · ಚೆಕ್ ಔಟ್',
    verifiedBadge: 'ಪರಿಶೀಲಿತ',
    staleBadge: 'ಹಳೆಯ ಲಭ್ಯತೆ (>30 ದಿನ)',
    evReady: 'ಇವಿ ಚಾರ್ಜಿಂಗ್',
    covered: 'ಮೇಲ್ಛಾವಣಿ ಇದೆ',
    inspectFormula: 'ಶ್ರೇಣೀಕರಣ ಸೂತ್ರ ವೀಕ್ಷಿಸಿ',
    pilotZone: 'ಯಲಹಂಕ ಪ್ರಾಯೋಗಿಕ ವಲಯ',
  },
  hi: {
    appName: 'वीपार्क',
    tagline: 'सही जगह पाएं। अपना समय बचाएं।',
    subtitle: 'अपने गंतव्य के पास सत्यापित पार्किंग स्थान खोजें, तुलना करें और बुक करें।',
    findParking: 'पार्किंग खोजें',
    listSpace: 'अपनी जगह लिस्ट करें',
    howItWorks: 'यह कैसे काम करता है',
    logIn: 'लॉग इन',
    myBookings: 'मेरी बुकिंग्स',
    monthlyPasses: 'मासिक पास',
    providerHub: 'होस्ट डैशबोर्ड',
    adminConsole: 'व्यवस्थापक कंसोल',
    rentSpaceTitle: 'अपनी जगह किराए पर दें',
    rentSpaceDesc: 'अपनी खाली आवासीय या व्यावसायिक पार्किंग जगह से नियमित आय अर्जित करें।',
    rentSpaceCta: 'शुरू करें',
    getParkingTitle: 'पार्किंग पाएं',
    getParkingDesc: 'बेंगलुरु में अपने गंतव्य के पास सुविधाजनक और सत्यापित पार्किंग खोजें।',
    getParkingCta: 'पार्किंग खोजें',
    searchPlaceholder: 'येलाहंका में अस्पताल, बाज़ार, स्टेशन खोजें...',
    useLocation: 'वर्तमान स्थान चुनें',
    radius: 'दायरा',
    sort: 'क्रमबद्ध करें',
    bestMatch: 'सर्वोत्तम मिलान',
    lowestPrice: 'सबसे कम दर',
    nearest: 'निकटतम दूरी',
    highestRated: 'उच्चतम रेटिंग',
    privateParking: 'निजी (सत्यापित)',
    commercialParking: 'व्यावसायिक आरक्षित',
    publicParking: 'सार्वजनिक (जानकारी मात्र)',
    reserveSpot: 'बुक करें',
    navigate: 'रास्ता देखें',
    slotsFree: 'स्थान खाली',
    perHour: '/घंटा',
    checkInNow: 'मैं पहुँच गया · चेक इन करें',
    checkOutNow: 'मैं निकल रहा हूँ · चेक आउट करें',
    verifiedBadge: 'सत्यापित',
    staleBadge: 'अपुष्ट >30 दिन',
    evReady: 'ईवी चार्जिंग',
    covered: 'कवर्ड',
    inspectFormula: 'रैंकिंग फ़ॉर्मूला जांचें',
    pilotZone: 'येलाहंका पायलट सक्रिय',
  },
};

export function getT(lang?: Language | string | null): TranslationDictionary {
  const safeLang = (lang === 'kn' || lang === 'hi' || lang === 'en') ? lang : 'en';
  const dict = translations[safeLang] || translations.en || {} as TranslationDictionary;
  
  if (typeof Proxy !== 'undefined') {
    return new Proxy(dict, {
      get(target, prop: string) {
        if (prop in target) {
          return (target as any)[prop];
        }
        if (translations.en && (translations.en as any)[prop]) {
          return (translations.en as any)[prop];
        }
        return prop;
      },
    });
  }
  return dict;
}
