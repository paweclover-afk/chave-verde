alter table public.ritmo_device_access
  drop constraint ritmo_device_access_label_check,
  add constraint ritmo_device_access_label_check
    check (label in ('leonarda-phone', 'adilson-phone', 'adilson-computer', 'unidentified'));
