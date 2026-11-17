-- SBM 2 inventory refresh. Existing out-of-scope rooms are deactivated, not deleted.
BEGIN;
DO $$
DECLARE pid VARCHAR(64); deluxe_id VARCHAR(64); suite_id VARCHAR(64);
BEGIN
 SELECT id INTO pid FROM properties WHERE code='sbm-guest-house' LIMIT 1;
 IF pid IS NULL THEN RAISE EXCEPTION 'sbm-guest-house property not found'; END IF;
 INSERT INTO room_types(id,property_id,property_code,room_code,name,description,capacity,bed_information,amenities,price_per_night,tax_percent,total_rooms,images,status)
 VALUES('sbm2-deluxe-room',pid,'sbm-guest-house','deluxe','Deluxe Room','Double occupancy; free WiFi, free parking, tea/coffee maker kit and two complimentary 500 ml water bottles.',2,'1 Double / King Bed','["Free WiFi","Free parking","Tea/Coffee Maker Kit","2 complimentary 500 ml water bottles"]'::jsonb,0,5,36,'[]'::jsonb,'active')
 ON CONFLICT(property_id,room_code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,capacity=EXCLUDED.capacity,bed_information=EXCLUDED.bed_information,amenities=EXCLUDED.amenities,tax_percent=5,total_rooms=36,status='active',updated_at=CURRENT_TIMESTAMP RETURNING id INTO deluxe_id;
 INSERT INTO room_types(id,property_id,property_code,room_code,name,description,capacity,bed_information,amenities,price_per_night,tax_percent,total_rooms,images,status)
 VALUES('sbm2-family-suite',pid,'sbm-guest-house','family','Family Suite','Four-person suite; one king bed, two single beds, tea/coffee maker kit, safety locker and four complimentary 500 ml water bottles.',4,'1 King Size Bed + 2 Single Beds','["Free WiFi","Free parking","Tea/Coffee Maker Kit","Safety locker","4 complimentary 500 ml water bottles"]'::jsonb,0,5,8,'[]'::jsonb,'active')
 ON CONFLICT(property_id,room_code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,capacity=EXCLUDED.capacity,bed_information=EXCLUDED.bed_information,amenities=EXCLUDED.amenities,tax_percent=5,total_rooms=8,status='active',updated_at=CURRENT_TIMESTAMP RETURNING id INTO suite_id;
 UPDATE room_types SET tax_percent=0,updated_at=CURRENT_TIMESTAMP WHERE property_code='sbm-hotel';
 UPDATE room_types SET tax_percent=5,updated_at=CURRENT_TIMESTAMP WHERE property_code='sbm-guest-house' AND room_code IN('deluxe','family');
 UPDATE rooms SET active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE property_id=pid AND room_number NOT IN('101','102','103','104','105','106','107','108','109','110','111','112','201','202','203','204','205','206','207','208','209','210','211','212','301','302','303','308','309','310','401','402','403','408','409','410','304','305','306','307','404','405','406','407')
 AND NOT EXISTS(SELECT 1 FROM reservation_rooms rr WHERE rr.room_id=rooms.id AND rr.status IN('ACTIVE','CHECKED_IN'));
 WITH inventory AS (
  SELECT n::text room_number,deluxe_id room_type_id,'deluxe' room_code,'Deluxe Room' room_name,
   CASE WHEN n<200 THEN '1st Floor' WHEN n<300 THEN '2nd Floor' WHEN n<400 THEN '3rd Floor' ELSE '4th Floor' END floor,
   2 max_guests,'1 Double / King Bed' bed_type,'["Free WiFi","Free parking","Tea/Coffee Maker Kit","2 complimentary 500 ml water bottles"]'::jsonb facilities
  FROM(SELECT generate_series(101,112) n UNION ALL SELECT generate_series(201,212) UNION ALL SELECT unnest(ARRAY[301,302,303,308,309,310,401,402,403,408,409,410])) d
  UNION ALL
  SELECT n::text,suite_id,'family','Family Suite',CASE WHEN n<400 THEN '3rd Floor' ELSE '4th Floor' END,4,'1 King Size Bed + 2 Single Beds',
   CASE WHEN n<400 THEN '["Free WiFi","Free parking","Tea/Coffee Maker Kit","Safety locker","4 complimentary 500 ml water bottles","Double bathroom"]'::jsonb ELSE '["Free WiFi","Free parking","Tea/Coffee Maker Kit","Safety locker","4 complimentary 500 ml water bottles","Single bathroom"]'::jsonb END
  FROM(SELECT unnest(ARRAY[304,305,306,307,404,405,406,407]) n) s
 )
 INSERT INTO rooms AS current_room(id,property_id,property_code,room_type_id,room_code,room_name,room_number,floor,operational_status,housekeeping_status,active,facilities,images,price,max_guests,bed_type)
 SELECT 'sbm2-room-'||i.room_number,pid,'sbm-guest-house',i.room_type_id,i.room_code,i.room_name,i.room_number,i.floor,'AVAILABLE','CLEAN',TRUE,i.facilities,'[]'::jsonb,0,i.max_guests,i.bed_type FROM inventory i
 ON CONFLICT(property_id,room_number) DO UPDATE SET room_type_id=EXCLUDED.room_type_id,room_code=EXCLUDED.room_code,room_name=EXCLUDED.room_name,floor=EXCLUDED.floor,active=TRUE,facilities=EXCLUDED.facilities,max_guests=EXCLUDED.max_guests,bed_type=EXCLUDED.bed_type,updated_at=CURRENT_TIMESTAMP
 WHERE NOT EXISTS(SELECT 1 FROM reservation_rooms rr WHERE rr.room_id=current_room.id AND rr.status IN('ACTIVE','CHECKED_IN'));
 UPDATE settings SET gst_percent=0,updated_at=CURRENT_TIMESTAMP WHERE id='default';
END $$;
COMMIT;
