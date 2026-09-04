export const DEFAULT_PHOTOS = {
  // Brand Logo
  logo: '/assets/images/sbm_logo.svg',

  // SBM Hotel 1 (Main Property)
  sbmHotelExterior: '/assets/images/sbm_hotel_ext_1786348685916.jpg',
  sbmHotelEvening: '/assets/images/sbm_hotel_eve_1786348725936.jpg',
  sbmEntranceFacade: '/assets/images/sbm_entrance_facade_1786348743037.jpg',

  // SBM 2 Guest House
  sbmGuestHouseExterior: '/assets/images/sbm_guest_house_ext_1786348705896.jpg',

  // Deluxe Room (Authentic Interiors)
  deluxeRoom: '/assets/images/deluxe_room_main_1786347291957.jpg',
  deluxeSeating: '/assets/images/deluxe_room_seating_1786347318111.jpg',
  deluxeLounge: '/assets/images/deluxe_room_lounge_1786347305108.jpg',

  // Family Suite (Authentic Interiors)
  familySuite: '/assets/images/family_suite_main_1786348221006.jpg',
  familySuiteTV: '/assets/images/family_suite_tv_unit_1786348237828.jpg',
};

export const ROOM_PHOTOS = {
  sbmDeluxe: [
    DEFAULT_PHOTOS.deluxeRoom,
    DEFAULT_PHOTOS.deluxeSeating,
    DEFAULT_PHOTOS.deluxeLounge,
  ],
  sbmFamily: [
    DEFAULT_PHOTOS.familySuite,
    DEFAULT_PHOTOS.familySuiteTV,
    DEFAULT_PHOTOS.deluxeLounge,
  ],
  ghDeluxe: [
    DEFAULT_PHOTOS.deluxeSeating,
    DEFAULT_PHOTOS.deluxeRoom,
    DEFAULT_PHOTOS.deluxeLounge,
  ],
  ghFamily: [
    DEFAULT_PHOTOS.familySuiteTV,
    DEFAULT_PHOTOS.familySuite,
    DEFAULT_PHOTOS.deluxeSeating,
  ],
  // Fallbacks
  deluxe: [
    DEFAULT_PHOTOS.deluxeRoom,
    DEFAULT_PHOTOS.deluxeSeating,
    DEFAULT_PHOTOS.deluxeLounge,
  ],
  family: [
    DEFAULT_PHOTOS.familySuite,
    DEFAULT_PHOTOS.familySuiteTV,
    DEFAULT_PHOTOS.deluxeLounge,
  ]
};

export const PROPERTY_PHOTOS = {
  sbmHotel: [
    DEFAULT_PHOTOS.sbmHotelExterior,
    DEFAULT_PHOTOS.sbmHotelEvening,
    DEFAULT_PHOTOS.sbmEntranceFacade,
  ],
  sbmGuestHouse: [
    DEFAULT_PHOTOS.sbmGuestHouseExterior,
    DEFAULT_PHOTOS.sbmEntranceFacade,
    DEFAULT_PHOTOS.sbmHotelEvening,
  ]
};
