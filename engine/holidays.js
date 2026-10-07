/* Holiday calendars for the date tools (business days, date difference).
 *
 * Every date here is copied from a government source, never worked out
 * from a rule, and only for the years that source has published. The
 * source of each year is in the comment above it; a date that differs from
 * the usual rule (a substitute day, a moved or one-off holiday) says why.
 *
 *   uk-ew, uk-sco, uk-ni   GOV.UK bank holidays, https://www.gov.uk/bank-holidays
 *                          (the feed https://www.gov.uk/bank-holidays.json,
 *                          fetched 2026-10-06; saved as
 *                          build/tests/fixtures/gov-uk-bank-holidays-2026-10-06.json)
 *   in-central             Department of Personnel and Training (DoPT), the
 *                          yearly Office Memorandum "Holidays to be observed
 *                          in Central Government Offices", Annexure-I: the
 *                          list for administrative offices at Delhi / New
 *                          Delhi, i.e. the 14 compulsory holidays plus the 3
 *                          DoPT chose for Delhi (marked "Delhi choice").
 *                          Offices elsewhere in India keep the 14 and choose
 *                          their own 3, so their list differs. Dates later
 *                          changed by a DoPT OM (a moon-sighting move) are
 *                          given as changed. Holidays declared by separate
 *                          orders during a year (e.g. Dr B. R. Ambedkar's
 *                          birthday) are not in Annexure-I and not here.
 *                          Transcribed 2026-10-06; JSON copy with the printed
 *                          weekdays in build/tests/fixtures/dopt-central-holidays.json.
 *   us-federal             US Office of Personnel Management, federal holiday
 *                          schedules, https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
 *                          (5 U.S.C. 6103; a Saturday holiday is observed on
 *                          the Friday before, 6103(b), a Sunday one on the
 *                          Monday after, E.O. 11582 s.3(a)). Fetched 2026-10-06.
 *                          Inauguration Day is left out: it is a holiday only
 *                          for federal staff in the Washington DC area. Days
 *                          off granted by a one-off executive order are not
 *                          in OPM's schedule and not here.
 *
 * window.HOLIDAYS.name(id, 'YYYY-MM-DD') gives the holiday's name or ''.
 * A date outside a calendar's years is simply not a holiday in it; the
 * tools say so when a count runs outside from–to.
 */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;

  var CAL = {
    'uk-ew': {
      name: 'England and Wales', from: 2019, to: 2028,
      source: 'https://www.gov.uk/bank-holidays', sourceName: 'GOV.UK',
      days: [
      // 2019: england-and-wales — GOV.UK bank holidays
      ['2019-01-01', 'New Year’s Day'],
      ['2019-04-19', 'Good Friday'],
      ['2019-04-22', 'Easter Monday'],
      ['2019-05-06', 'Early May bank holiday'],
      ['2019-05-27', 'Spring bank holiday'],
      ['2019-08-26', 'Summer bank holiday'],
      ['2019-12-25', 'Christmas Day'],
      ['2019-12-26', 'Boxing Day'],
      // 2020: england-and-wales — GOV.UK bank holidays
      ['2020-01-01', 'New Year’s Day'],
      ['2020-04-10', 'Good Friday'],
      ['2020-04-13', 'Easter Monday'],
      ['2020-05-08', 'Early May bank holiday (VE day)'], // moved from Monday 4 May 2020 to mark the 75th anniversary of VE Day
      ['2020-05-25', 'Spring bank holiday'],
      ['2020-08-31', 'Summer bank holiday'],
      ['2020-12-25', 'Christmas Day'],
      ['2020-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2020 falls at the weekend; the bank holiday is the next free weekday
      // 2021: england-and-wales — GOV.UK bank holidays
      ['2021-01-01', 'New Year’s Day'],
      ['2021-04-02', 'Good Friday'],
      ['2021-04-05', 'Easter Monday'],
      ['2021-05-03', 'Early May bank holiday'],
      ['2021-05-31', 'Spring bank holiday'],
      ['2021-08-30', 'Summer bank holiday'],
      ['2021-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2021 falls at the weekend; the bank holiday is the next free weekday
      ['2021-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2021 falls at the weekend; the bank holiday is the next free weekday
      // 2022: england-and-wales — GOV.UK bank holidays
      ['2022-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2022 falls at the weekend; the bank holiday is the next free weekday
      ['2022-04-15', 'Good Friday'],
      ['2022-04-18', 'Easter Monday'],
      ['2022-05-02', 'Early May bank holiday'],
      ['2022-06-02', 'Spring bank holiday'], // moved from the last Monday in May (30 May 2022) for the Platinum Jubilee
      ['2022-06-03', 'Platinum Jubilee bank holiday'], // one-off, for the Platinum Jubilee
      ['2022-08-29', 'Summer bank holiday'],
      ['2022-09-19', 'Bank Holiday for the State Funeral of Queen Elizabeth II'], // one-off, for the State Funeral of Queen Elizabeth II
      ['2022-12-26', 'Boxing Day'],
      ['2022-12-27', 'Christmas Day (substitute day)'], // Sunday 25 December 2022 falls at the weekend; the bank holiday is the next free weekday
      // 2023: england-and-wales — GOV.UK bank holidays
      ['2023-01-02', 'New Year’s Day (substitute day)'], // Sunday 1 January 2023 falls at the weekend; the bank holiday is the next free weekday
      ['2023-04-07', 'Good Friday'],
      ['2023-04-10', 'Easter Monday'],
      ['2023-05-01', 'Early May bank holiday'],
      ['2023-05-08', 'Bank holiday for the coronation of King Charles III'], // one-off, for the coronation of King Charles III
      ['2023-05-29', 'Spring bank holiday'],
      ['2023-08-28', 'Summer bank holiday'],
      ['2023-12-25', 'Christmas Day'],
      ['2023-12-26', 'Boxing Day'],
      // 2024: england-and-wales — GOV.UK bank holidays
      ['2024-01-01', 'New Year’s Day'],
      ['2024-03-29', 'Good Friday'],
      ['2024-04-01', 'Easter Monday'],
      ['2024-05-06', 'Early May bank holiday'],
      ['2024-05-27', 'Spring bank holiday'],
      ['2024-08-26', 'Summer bank holiday'],
      ['2024-12-25', 'Christmas Day'],
      ['2024-12-26', 'Boxing Day'],
      // 2025: england-and-wales — GOV.UK bank holidays
      ['2025-01-01', 'New Year’s Day'],
      ['2025-04-18', 'Good Friday'],
      ['2025-04-21', 'Easter Monday'],
      ['2025-05-05', 'Early May bank holiday'],
      ['2025-05-26', 'Spring bank holiday'],
      ['2025-08-25', 'Summer bank holiday'],
      ['2025-12-25', 'Christmas Day'],
      ['2025-12-26', 'Boxing Day'],
      // 2026: england-and-wales — GOV.UK bank holidays
      ['2026-01-01', 'New Year’s Day'],
      ['2026-04-03', 'Good Friday'],
      ['2026-04-06', 'Easter Monday'],
      ['2026-05-04', 'Early May bank holiday'],
      ['2026-05-25', 'Spring bank holiday'],
      ['2026-08-31', 'Summer bank holiday'],
      ['2026-12-25', 'Christmas Day'],
      ['2026-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2026 falls at the weekend; the bank holiday is the next free weekday
      // 2027: england-and-wales — GOV.UK bank holidays
      ['2027-01-01', 'New Year’s Day'],
      ['2027-03-26', 'Good Friday'],
      ['2027-03-29', 'Easter Monday'],
      ['2027-05-03', 'Early May bank holiday'],
      ['2027-05-31', 'Spring bank holiday'],
      ['2027-08-30', 'Summer bank holiday'],
      ['2027-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2027 falls at the weekend; the bank holiday is the next free weekday
      ['2027-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2027 falls at the weekend; the bank holiday is the next free weekday
      // 2028: england-and-wales — GOV.UK bank holidays
      ['2028-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2028 falls at the weekend; the bank holiday is the next free weekday
      ['2028-04-14', 'Good Friday'],
      ['2028-04-17', 'Easter Monday'],
      ['2028-05-01', 'Early May bank holiday'],
      ['2028-05-29', 'Spring bank holiday'],
      ['2028-08-28', 'Summer bank holiday'],
      ['2028-12-25', 'Christmas Day'],
      ['2028-12-26', 'Boxing Day'],
      ]
    },
    'uk-sco': {
      name: 'Scotland', from: 2019, to: 2028,
      source: 'https://www.gov.uk/bank-holidays', sourceName: 'GOV.UK',
      days: [
      // 2019: scotland — GOV.UK bank holidays
      ['2019-01-01', 'New Year’s Day'],
      ['2019-01-02', '2nd January'],
      ['2019-04-19', 'Good Friday'],
      ['2019-05-06', 'Early May bank holiday'],
      ['2019-05-27', 'Spring bank holiday'],
      ['2019-08-05', 'Summer bank holiday'],
      ['2019-12-02', 'St Andrew’s Day (substitute day)'], // Saturday 30 November 2019 falls at the weekend; the bank holiday is the next free weekday
      ['2019-12-25', 'Christmas Day'],
      ['2019-12-26', 'Boxing Day'],
      // 2020: scotland — GOV.UK bank holidays
      ['2020-01-01', 'New Year’s Day'],
      ['2020-01-02', '2nd January'],
      ['2020-04-10', 'Good Friday'],
      ['2020-05-08', 'Early May bank holiday (VE day)'], // moved from Monday 4 May 2020 to mark the 75th anniversary of VE Day
      ['2020-05-25', 'Spring bank holiday'],
      ['2020-08-03', 'Summer bank holiday'],
      ['2020-11-30', 'St Andrew’s Day'],
      ['2020-12-25', 'Christmas Day'],
      ['2020-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2020 falls at the weekend; the bank holiday is the next free weekday
      // 2021: scotland — GOV.UK bank holidays
      ['2021-01-01', 'New Year’s Day'],
      ['2021-01-04', '2nd January (substitute day)'], // Saturday 2 January 2021 falls at the weekend; the bank holiday is the next free weekday
      ['2021-04-02', 'Good Friday'],
      ['2021-05-03', 'Early May bank holiday'],
      ['2021-05-31', 'Spring bank holiday'],
      ['2021-08-02', 'Summer bank holiday'],
      ['2021-11-30', 'St Andrew’s Day'],
      ['2021-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2021 falls at the weekend; the bank holiday is the next free weekday
      ['2021-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2021 falls at the weekend; the bank holiday is the next free weekday
      // 2022: scotland — GOV.UK bank holidays
      ['2022-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2022 falls at the weekend; the bank holiday is the next free weekday
      ['2022-01-04', '2nd January (substitute day)'], // Sunday 2 January 2022 falls at the weekend; the bank holiday is the next free weekday
      ['2022-04-15', 'Good Friday'],
      ['2022-05-02', 'Early May bank holiday'],
      ['2022-06-02', 'Spring bank holiday'], // moved from the last Monday in May (30 May 2022) for the Platinum Jubilee
      ['2022-06-03', 'Platinum Jubilee bank holiday'], // one-off, for the Platinum Jubilee
      ['2022-08-01', 'Summer bank holiday'],
      ['2022-09-19', 'Bank Holiday for the State Funeral of Queen Elizabeth II'], // one-off, for the State Funeral of Queen Elizabeth II
      ['2022-11-30', 'St Andrew’s Day'],
      ['2022-12-26', 'Boxing Day'],
      ['2022-12-27', 'Christmas Day (substitute day)'], // Sunday 25 December 2022 falls at the weekend; the bank holiday is the next free weekday
      // 2023: scotland — GOV.UK bank holidays
      ['2023-01-02', 'New Year’s Day (substitute day)'], // Sunday 1 January 2023 falls at the weekend; the bank holiday is the next free weekday
      ['2023-01-03', '2nd January (substitute day)'], // Monday 2 January 2023 is already another holiday’s substitute day, so this one moves to the next free weekday
      ['2023-04-07', 'Good Friday'],
      ['2023-05-01', 'Early May bank holiday'],
      ['2023-05-08', 'Bank holiday for the coronation of King Charles III'], // one-off, for the coronation of King Charles III
      ['2023-05-29', 'Spring bank holiday'],
      ['2023-08-07', 'Summer bank holiday'],
      ['2023-11-30', 'St Andrew’s Day'],
      ['2023-12-25', 'Christmas Day'],
      ['2023-12-26', 'Boxing Day'],
      // 2024: scotland — GOV.UK bank holidays
      ['2024-01-01', 'New Year’s Day'],
      ['2024-01-02', '2nd January'],
      ['2024-03-29', 'Good Friday'],
      ['2024-05-06', 'Early May bank holiday'],
      ['2024-05-27', 'Spring bank holiday'],
      ['2024-08-05', 'Summer bank holiday'],
      ['2024-12-02', 'St Andrew’s Day (substitute day)'], // Saturday 30 November 2024 falls at the weekend; the bank holiday is the next free weekday
      ['2024-12-25', 'Christmas Day'],
      ['2024-12-26', 'Boxing Day'],
      // 2025: scotland — GOV.UK bank holidays
      ['2025-01-01', 'New Year’s Day'],
      ['2025-01-02', '2nd January'],
      ['2025-04-18', 'Good Friday'],
      ['2025-05-05', 'Early May bank holiday'],
      ['2025-05-26', 'Spring bank holiday'],
      ['2025-08-04', 'Summer bank holiday'],
      ['2025-12-01', 'St Andrew’s Day (substitute day)'], // Sunday 30 November 2025 falls at the weekend; the bank holiday is the next free weekday
      ['2025-12-25', 'Christmas Day'],
      ['2025-12-26', 'Boxing Day'],
      // 2026: scotland — GOV.UK bank holidays
      ['2026-01-01', 'New Year’s Day'],
      ['2026-01-02', '2nd January'],
      ['2026-04-03', 'Good Friday'],
      ['2026-05-04', 'Early May bank holiday'],
      ['2026-05-25', 'Spring bank holiday'],
      ['2026-06-15', 'World Cup bank holiday'], // one-off, Scotland only, as listed by GOV.UK
      ['2026-08-03', 'Summer bank holiday'],
      ['2026-11-30', 'St Andrew’s Day'],
      ['2026-12-25', 'Christmas Day'],
      ['2026-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2026 falls at the weekend; the bank holiday is the next free weekday
      // 2027: scotland — GOV.UK bank holidays
      ['2027-01-01', 'New Year’s Day'],
      ['2027-01-04', '2nd January (substitute day)'], // Saturday 2 January 2027 falls at the weekend; the bank holiday is the next free weekday
      ['2027-03-26', 'Good Friday'],
      ['2027-05-03', 'Early May bank holiday'],
      ['2027-05-31', 'Spring bank holiday'],
      ['2027-08-02', 'Summer bank holiday'],
      ['2027-11-30', 'St Andrew’s Day'],
      ['2027-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2027 falls at the weekend; the bank holiday is the next free weekday
      ['2027-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2027 falls at the weekend; the bank holiday is the next free weekday
      // 2028: scotland — GOV.UK bank holidays
      ['2028-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2028 falls at the weekend; the bank holiday is the next free weekday
      ['2028-01-04', '2nd January (substitute day)'], // Sunday 2 January 2028 falls at the weekend; the bank holiday is the next free weekday
      ['2028-04-14', 'Good Friday'],
      ['2028-05-01', 'Early May bank holiday'],
      ['2028-05-29', 'Spring bank holiday'],
      ['2028-08-07', 'Summer bank holiday'],
      ['2028-11-30', 'St Andrew’s Day'],
      ['2028-12-25', 'Christmas Day'],
      ['2028-12-26', 'Boxing Day'],
      ]
    },
    'uk-ni': {
      name: 'Northern Ireland', from: 2019, to: 2028,
      source: 'https://www.gov.uk/bank-holidays', sourceName: 'GOV.UK',
      days: [
      // 2019: northern-ireland — GOV.UK bank holidays
      ['2019-01-01', 'New Year’s Day'],
      ['2019-03-18', 'St Patrick’s Day (substitute day)'], // Sunday 17 March 2019 falls at the weekend; the bank holiday is the next free weekday
      ['2019-04-19', 'Good Friday'],
      ['2019-04-22', 'Easter Monday'],
      ['2019-05-06', 'Early May bank holiday'],
      ['2019-05-27', 'Spring bank holiday'],
      ['2019-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2019-08-26', 'Summer bank holiday'],
      ['2019-12-25', 'Christmas Day'],
      ['2019-12-26', 'Boxing Day'],
      // 2020: northern-ireland — GOV.UK bank holidays
      ['2020-01-01', 'New Year’s Day'],
      ['2020-03-17', 'St Patrick’s Day'],
      ['2020-04-10', 'Good Friday'],
      ['2020-04-13', 'Easter Monday'],
      ['2020-05-08', 'Early May bank holiday (VE day)'], // moved from Monday 4 May 2020 to mark the 75th anniversary of VE Day
      ['2020-05-25', 'Spring bank holiday'],
      ['2020-07-13', 'Battle of the Boyne (Orangemen’s Day) (substitute day)'], // Sunday 12 July 2020 falls at the weekend; the bank holiday is the next free weekday
      ['2020-08-31', 'Summer bank holiday'],
      ['2020-12-25', 'Christmas Day'],
      ['2020-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2020 falls at the weekend; the bank holiday is the next free weekday
      // 2021: northern-ireland — GOV.UK bank holidays
      ['2021-01-01', 'New Year’s Day'],
      ['2021-03-17', 'St Patrick’s Day'],
      ['2021-04-02', 'Good Friday'],
      ['2021-04-05', 'Easter Monday'],
      ['2021-05-03', 'Early May bank holiday'],
      ['2021-05-31', 'Spring bank holiday'],
      ['2021-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2021-08-30', 'Summer bank holiday'],
      ['2021-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2021 falls at the weekend; the bank holiday is the next free weekday
      ['2021-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2021 falls at the weekend; the bank holiday is the next free weekday
      // 2022: northern-ireland — GOV.UK bank holidays
      ['2022-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2022 falls at the weekend; the bank holiday is the next free weekday
      ['2022-03-17', 'St Patrick’s Day'],
      ['2022-04-15', 'Good Friday'],
      ['2022-04-18', 'Easter Monday'],
      ['2022-05-02', 'Early May bank holiday'],
      ['2022-06-02', 'Spring bank holiday'], // moved from the last Monday in May (30 May 2022) for the Platinum Jubilee
      ['2022-06-03', 'Platinum Jubilee bank holiday'], // one-off, for the Platinum Jubilee
      ['2022-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2022-08-29', 'Summer bank holiday'],
      ['2022-09-19', 'Bank Holiday for the State Funeral of Queen Elizabeth II'], // one-off, for the State Funeral of Queen Elizabeth II
      ['2022-12-26', 'Boxing Day'],
      ['2022-12-27', 'Christmas Day (substitute day)'], // Sunday 25 December 2022 falls at the weekend; the bank holiday is the next free weekday
      // 2023: northern-ireland — GOV.UK bank holidays
      ['2023-01-02', 'New Year’s Day (substitute day)'], // Sunday 1 January 2023 falls at the weekend; the bank holiday is the next free weekday
      ['2023-03-17', 'St Patrick’s Day'],
      ['2023-04-07', 'Good Friday'],
      ['2023-04-10', 'Easter Monday'],
      ['2023-05-01', 'Early May bank holiday'],
      ['2023-05-08', 'Bank holiday for the coronation of King Charles III'], // one-off, for the coronation of King Charles III
      ['2023-05-29', 'Spring bank holiday'],
      ['2023-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2023-08-28', 'Summer bank holiday'],
      ['2023-12-25', 'Christmas Day'],
      ['2023-12-26', 'Boxing Day'],
      // 2024: northern-ireland — GOV.UK bank holidays
      ['2024-01-01', 'New Year’s Day'],
      ['2024-03-18', 'St Patrick’s Day (substitute day)'], // Sunday 17 March 2024 falls at the weekend; the bank holiday is the next free weekday
      ['2024-03-29', 'Good Friday'],
      ['2024-04-01', 'Easter Monday'],
      ['2024-05-06', 'Early May bank holiday'],
      ['2024-05-27', 'Spring bank holiday'],
      ['2024-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2024-08-26', 'Summer bank holiday'],
      ['2024-12-25', 'Christmas Day'],
      ['2024-12-26', 'Boxing Day'],
      // 2025: northern-ireland — GOV.UK bank holidays
      ['2025-01-01', 'New Year’s Day'],
      ['2025-03-17', 'St Patrick’s Day'],
      ['2025-04-18', 'Good Friday'],
      ['2025-04-21', 'Easter Monday'],
      ['2025-05-05', 'Early May bank holiday'],
      ['2025-05-26', 'Spring bank holiday'],
      ['2025-07-14', 'Battle of the Boyne (Orangemen’s Day) (substitute day)'], // Saturday 12 July 2025 falls at the weekend; the bank holiday is the next free weekday
      ['2025-08-25', 'Summer bank holiday'],
      ['2025-12-25', 'Christmas Day'],
      ['2025-12-26', 'Boxing Day'],
      // 2026: northern-ireland — GOV.UK bank holidays
      ['2026-01-01', 'New Year’s Day'],
      ['2026-03-17', 'St Patrick’s Day'],
      ['2026-04-03', 'Good Friday'],
      ['2026-04-06', 'Easter Monday'],
      ['2026-05-04', 'Early May bank holiday'],
      ['2026-05-25', 'Spring bank holiday'],
      ['2026-07-13', 'Battle of the Boyne (Orangemen’s Day) (substitute day)'], // Sunday 12 July 2026 falls at the weekend; the bank holiday is the next free weekday
      ['2026-08-31', 'Summer bank holiday'],
      ['2026-12-25', 'Christmas Day'],
      ['2026-12-28', 'Boxing Day (substitute day)'], // Saturday 26 December 2026 falls at the weekend; the bank holiday is the next free weekday
      // 2027: northern-ireland — GOV.UK bank holidays
      ['2027-01-01', 'New Year’s Day'],
      ['2027-03-17', 'St Patrick’s Day'],
      ['2027-03-26', 'Good Friday'],
      ['2027-03-29', 'Easter Monday'],
      ['2027-05-03', 'Early May bank holiday'],
      ['2027-05-31', 'Spring bank holiday'],
      ['2027-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2027-08-30', 'Summer bank holiday'],
      ['2027-12-27', 'Christmas Day (substitute day)'], // Saturday 25 December 2027 falls at the weekend; the bank holiday is the next free weekday
      ['2027-12-28', 'Boxing Day (substitute day)'], // Sunday 26 December 2027 falls at the weekend; the bank holiday is the next free weekday
      // 2028: northern-ireland — GOV.UK bank holidays
      ['2028-01-03', 'New Year’s Day (substitute day)'], // Saturday 1 January 2028 falls at the weekend; the bank holiday is the next free weekday
      ['2028-03-17', 'St Patrick’s Day'],
      ['2028-04-14', 'Good Friday'],
      ['2028-04-17', 'Easter Monday'],
      ['2028-05-01', 'Early May bank holiday'],
      ['2028-05-29', 'Spring bank holiday'],
      ['2028-07-12', 'Battle of the Boyne (Orangemen’s Day)'],
      ['2028-08-28', 'Summer bank holiday'],
      ['2028-12-25', 'Christmas Day'],
      ['2028-12-26', 'Boxing Day'],
      ]
    },
    'in-central': {
      name: 'India central government (Delhi / New Delhi)', from: 2021, to: 2027,
      source: 'https://dopt.gov.in/', sourceName: 'Department of Personnel and Training',
      days: [
      // 2021: DoPT OM F.No.12/9/2020-JCA-2 of 10 June 2020, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/HolidaylistKKLde.pdf
      ['2021-01-26', 'Republic Day'],
      ['2021-03-29', 'Holi (Delhi choice)'],
      ['2021-04-02', 'Good Friday'],
      ['2021-04-21', 'Ram Navami (Delhi choice)'],
      ['2021-04-25', 'Mahavir Jayanti'],
      ['2021-05-14', 'Id-ul-Fitr'],
      ['2021-05-26', 'Budha Purnima'],
      ['2021-07-21', 'Id-ul-Zuha (Bakrid)'],
      ['2021-08-15', 'Independence Day'],
      ['2021-08-20', 'Muharram'], // printed as Thursday 19 August 2021; moved by OM No.12/13/2016-JCA-2 of 11 August 2021, https://documents.doptcirculars.nic.in/D2/D02est/MuharramhiZm8.PDF
      ['2021-08-30', 'Janmashtami (Delhi choice)'],
      ['2021-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2021-10-15', 'Dussehra'],
      ['2021-10-19', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2021-11-04', 'Diwali (Deepavali)'],
      ['2021-11-19', 'Guru Nanak’s Birthday'],
      ['2021-12-25', 'Christmas Day'],
      // 2022: DoPT OM F.No.12/5/2021-JCA-2 of 8 June 2021, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/holiday%20list%2020220rsMX.pdf
      ['2022-01-26', 'Republic Day'],
      ['2022-03-01', 'Maha Shivratri (Delhi choice)'],
      ['2022-03-18', 'Holi (Delhi choice)'],
      ['2022-04-14', 'Mahavir Jayanti'],
      ['2022-04-15', 'Good Friday'],
      ['2022-05-03', 'Id-ul-Fitr'],
      ['2022-05-16', 'Budha Purnima'],
      ['2022-07-10', 'Id-ul-Zuha (Bakrid)'],
      ['2022-08-09', 'Muharram'],
      ['2022-08-15', 'Independence Day'],
      ['2022-08-19', 'Janmashtami (Delhi choice)'],
      ['2022-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2022-10-05', 'Dussehra'],
      ['2022-10-09', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2022-10-24', 'Diwali (Deepavali)'],
      ['2022-11-08', 'Guru Nanak’s Birthday'],
      ['2022-12-25', 'Christmas Day'],
      // 2023: DoPT OM F.No.12/5/2022-JCA of 16 June 2022, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/Naresh_NIC_1_20220616164953373JH62n.pdf
      ['2023-01-26', 'Republic Day'],
      ['2023-03-08', 'Holi (Delhi choice)'],
      ['2023-03-30', 'Ram Navami (Delhi choice)'],
      ['2023-04-04', 'Mahavir Jayanti'],
      ['2023-04-07', 'Good Friday'],
      ['2023-04-22', 'Id-ul-Fitr'],
      ['2023-05-05', 'Budha Purnima'],
      ['2023-06-29', 'Id-ul-Zuha (Bakrid)'],
      ['2023-07-29', 'Muharram'],
      ['2023-08-15', 'Independence Day'],
      ['2023-09-07', 'Janmashtami (Vaishnva) (Delhi choice)'],
      ['2023-09-28', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2023-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2023-10-24', 'Dussehra'],
      ['2023-11-12', 'Diwali (Deepavali)'],
      ['2023-11-27', 'Guru Nanak’s Birthday'],
      ['2023-12-25', 'Christmas Day'],
      // 2024: DoPT OM F.No.12/2/2023-JCA of 3 July 2023, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/Holiday%20to%20be%20observed%20in%20Central%20government%20offices%20during%20the%20year%202024kFtwz.PDF
      ['2024-01-26', 'Republic Day'],
      ['2024-03-25', 'Holi (Delhi choice)'],
      ['2024-03-29', 'Good Friday'],
      ['2024-04-11', 'Id-ul-Fitr'],
      ['2024-04-17', 'Ram Navami (Delhi choice)'],
      ['2024-04-21', 'Mahavir Jayanti'],
      ['2024-05-23', 'Budha Purnima'],
      ['2024-06-17', 'Id-ul-Zuha (Bakrid)'],
      ['2024-07-17', 'Muharram'],
      ['2024-08-15', 'Independence Day'],
      ['2024-08-26', 'Janmashtami (Vaishnva) (Delhi choice)'],
      ['2024-09-16', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2024-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2024-10-12', 'Dussehra'],
      ['2024-10-31', 'Diwali (Deepavali)'],
      ['2024-11-15', 'Guru Nanak’s Birthday'],
      ['2024-12-25', 'Christmas Day'],
      // 2025: DoPT OM F.No.12/2/2023-JCA of 9 July 2024, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/List%20of%20holidays%202025KtKLw.pdf
      ['2025-01-26', 'Republic Day'],
      ['2025-02-26', 'Maha Shivaratri (Delhi choice)'],
      ['2025-03-14', 'Holi (Delhi choice)'],
      ['2025-03-31', 'Id-ul-Fitr'],
      ['2025-04-10', 'Mahavir Jayanti'],
      ['2025-04-18', 'Good Friday'],
      ['2025-05-12', 'Budha Purnima'],
      ['2025-06-07', 'Id-ul-Zuha (Bakrid)'],
      ['2025-07-06', 'Muharram'],
      ['2025-08-15', 'Independence Day'],
      ['2025-08-16', 'Janmashtami (Delhi choice)'],
      ['2025-09-05', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2025-10-02', 'Mahatma Gandhi’s Birthday; Dussehra'], // two holidays on one date, as the OM lists them
      ['2025-10-20', 'Diwali (Deepavali)'],
      ['2025-11-05', 'Guru Nanak’s Birthday'],
      ['2025-12-25', 'Christmas Day'],
      // 2026: DoPT OM F.No.12/2/2023-JCA of 3 July 2025, Annexure-I
      //   https://documents.doptcirculars.nic.in/D2/D02est/Holidays%20to%20be%20observed%20in%20Central%20Government%20Offices%20during%20the%20year%2020265vgBs.pdf
      ['2026-01-26', 'Republic Day'],
      ['2026-03-04', 'Holi (Delhi choice)'],
      ['2026-03-21', 'Id-ul-Fitr'],
      ['2026-03-26', 'Ram Navami (Delhi choice)'],
      ['2026-03-31', 'Mahavir Jayanti'],
      ['2026-04-03', 'Good Friday'],
      ['2026-05-01', 'Budha Purnima'],
      ['2026-05-28', 'Id-ul-Zuha (Bakrid)'], // printed as Wednesday 27 May 2026; moved by OM F.No.12/3/2023-JCA of 22 May 2026, https://www.icmr.gov.in/icmrobject/uploads/Circular/1779704410_changeofdateofholidayonaccountofid-u-zuha.pdf
      ['2026-06-26', 'Muharram'],
      ['2026-08-15', 'Independence Day'],
      ['2026-08-26', 'Milad-un-Nabi or Id-e-Milad (Birthday of Prophet Mohammad)'],
      ['2026-09-04', 'Janmashtami (Vaishnva) (Delhi choice)'],
      ['2026-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2026-10-20', 'Dussehra'],
      ['2026-11-08', 'Diwali (Deepavali)'],
      ['2026-11-24', 'Guru Nanak’s Birthday'],
      ['2026-12-25', 'Christmas Day'],
      // 2027: DoPT OM F.No.12/2/2023-JCA of 16 July 2026, Annexure-I
      //   https://utilities.cept.gov.in/dop/pdfbind.ashx?id=15435
      //   (the OM as forwarded in full by the Department of Posts, letter Y-21/2/2026-PE-II-DOP of 8 September 2026)
      ['2027-01-26', 'Republic Day'],
      ['2027-03-10', 'Id-ul-Fitr'],
      ['2027-03-23', 'Holi (Delhi choice)'],
      ['2027-03-26', 'Good Friday'],
      ['2027-04-15', 'Ram Navami (Delhi choice)'],
      ['2027-04-19', 'Mahavir Jayanti'],
      ['2027-05-17', 'Id-ul-Zuha (Bakrid)'],
      ['2027-05-20', 'Budha Purnima'],
      ['2027-06-16', 'Muharram'],
      ['2027-08-15', 'Independence Day; Milad-un-Nabi or Id-e-Milad (Prophet Mohammad’s Birthday)'], // two holidays on one date, as the OM lists them
      ['2027-08-25', 'Janmashtami (Vaishnav) (Delhi choice)'],
      ['2027-10-02', 'Mahatma Gandhi’s Birthday'],
      ['2027-10-09', 'Dussehra (Vijaya Dashmi)'],
      ['2027-10-29', 'Diwali (Deepavali)'],
      ['2027-11-14', 'Guru Nanak’s Birthday'],
      ['2027-12-25', 'Christmas Day'],
      ]
    },
    'us-federal': {
      name: 'US federal', from: 2012, to: 2030,
      source: 'https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/', sourceName: 'US Office of Personnel Management',
      days: [
      // 2012: OPM 2012 Holiday Schedule
      ['2012-01-02', 'New Year’s Day'], // Sunday 1 January 2012: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2012-01-16', 'Birthday of Martin Luther King, Jr.'],
      ['2012-02-20', 'Washington’s Birthday'],
      ['2012-05-28', 'Memorial Day'],
      ['2012-07-04', 'Independence Day'],
      ['2012-09-03', 'Labor Day'],
      ['2012-10-08', 'Columbus Day'],
      ['2012-11-12', 'Veterans Day'], // Sunday 11 November 2012: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2012-11-22', 'Thanksgiving Day'],
      ['2012-12-25', 'Christmas Day'],
      // 2013: OPM 2013 Holiday Schedule
      ['2013-01-01', 'New Year’s Day'],
      ['2013-01-21', 'Birthday of Martin Luther King, Jr.'],
      ['2013-02-18', 'Washington’s Birthday'],
      ['2013-05-27', 'Memorial Day'],
      ['2013-07-04', 'Independence Day'],
      ['2013-09-02', 'Labor Day'],
      ['2013-10-14', 'Columbus Day'],
      ['2013-11-11', 'Veterans Day'],
      ['2013-11-28', 'Thanksgiving Day'],
      ['2013-12-25', 'Christmas Day'],
      // 2014: OPM 2014 Holiday Schedule
      ['2014-01-01', 'New Year’s Day'],
      ['2014-01-20', 'Birthday of Martin Luther King, Jr.'],
      ['2014-02-17', 'Washington’s Birthday'],
      ['2014-05-26', 'Memorial Day'],
      ['2014-07-04', 'Independence Day'],
      ['2014-09-01', 'Labor Day'],
      ['2014-10-13', 'Columbus Day'],
      ['2014-11-11', 'Veterans Day'],
      ['2014-11-27', 'Thanksgiving Day'],
      ['2014-12-25', 'Christmas Day'],
      // 2015: OPM 2015 Holiday Schedule
      ['2015-01-01', 'New Year’s Day'],
      ['2015-01-19', 'Birthday of Martin Luther King, Jr.'],
      ['2015-02-16', 'Washington’s Birthday'],
      ['2015-05-25', 'Memorial Day'],
      ['2015-07-03', 'Independence Day'], // Saturday 4 July 2015: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2015-09-07', 'Labor Day'],
      ['2015-10-12', 'Columbus Day'],
      ['2015-11-11', 'Veterans Day'],
      ['2015-11-26', 'Thanksgiving Day'],
      ['2015-12-25', 'Christmas Day'],
      // 2016: OPM 2016 Holiday Schedule
      ['2016-01-01', 'New Year’s Day'],
      ['2016-01-18', 'Birthday of Martin Luther King, Jr.'],
      ['2016-02-15', 'Washington’s Birthday'],
      ['2016-05-30', 'Memorial Day'],
      ['2016-07-04', 'Independence Day'],
      ['2016-09-05', 'Labor Day'],
      ['2016-10-10', 'Columbus Day'],
      ['2016-11-11', 'Veterans Day'],
      ['2016-11-24', 'Thanksgiving Day'],
      ['2016-12-26', 'Christmas Day'], // Sunday 25 December 2016: observed on the Monday after, Executive Order 11582 s.3(a)
      // 2017: OPM 2017 Holiday Schedule
      ['2017-01-02', 'New Year’s Day'], // Sunday 1 January 2017: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2017-01-16', 'Birthday of Martin Luther King, Jr.'],
      ['2017-02-20', 'Washington’s Birthday'],
      ['2017-05-29', 'Memorial Day'],
      ['2017-07-04', 'Independence Day'],
      ['2017-09-04', 'Labor Day'],
      ['2017-10-09', 'Columbus Day'],
      ['2017-11-10', 'Veterans Day'], // Saturday 11 November 2017: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2017-11-23', 'Thanksgiving Day'],
      ['2017-12-25', 'Christmas Day'],
      // 2018: OPM 2018 Holiday Schedule
      ['2018-01-01', 'New Year’s Day'],
      ['2018-01-15', 'Birthday of Martin Luther King, Jr.'],
      ['2018-02-19', 'Washington’s Birthday'],
      ['2018-05-28', 'Memorial Day'],
      ['2018-07-04', 'Independence Day'],
      ['2018-09-03', 'Labor Day'],
      ['2018-10-08', 'Columbus Day'],
      ['2018-11-12', 'Veterans Day'], // Sunday 11 November 2018: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2018-11-22', 'Thanksgiving Day'],
      ['2018-12-25', 'Christmas Day'],
      // 2019: OPM 2019 Holiday Schedule
      ['2019-01-01', 'New Year’s Day'],
      ['2019-01-21', 'Birthday of Martin Luther King, Jr.'],
      ['2019-02-18', 'Washington’s Birthday'],
      ['2019-05-27', 'Memorial Day'],
      ['2019-07-04', 'Independence Day'],
      ['2019-09-02', 'Labor Day'],
      ['2019-10-14', 'Columbus Day'],
      ['2019-11-11', 'Veterans Day'],
      ['2019-11-28', 'Thanksgiving Day'],
      ['2019-12-25', 'Christmas Day'],
      // 2020: OPM 2020 Holiday Schedule
      ['2020-01-01', 'New Year’s Day'],
      ['2020-01-20', 'Birthday of Martin Luther King, Jr.'],
      ['2020-02-17', 'Washington’s Birthday'],
      ['2020-05-25', 'Memorial Day'],
      ['2020-07-03', 'Independence Day'], // Saturday 4 July 2020: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2020-09-07', 'Labor Day'],
      ['2020-10-12', 'Columbus Day'],
      ['2020-11-11', 'Veterans Day'],
      ['2020-11-26', 'Thanksgiving Day'],
      ['2020-12-25', 'Christmas Day'],
      // 2021: OPM 2021 Holiday Schedule
      ['2021-01-01', 'New Year’s Day'],
      ['2021-01-18', 'Birthday of Martin Luther King, Jr.'],
      ['2021-02-15', 'Washington’s Birthday'],
      ['2021-05-31', 'Memorial Day'],
      ['2021-06-18', 'Juneteenth National Independence Day'], // Saturday 19 June 2021: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2021-07-05', 'Independence Day'], // Sunday 4 July 2021: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2021-09-06', 'Labor Day'],
      ['2021-10-11', 'Columbus Day'],
      ['2021-11-11', 'Veterans Day'],
      ['2021-11-25', 'Thanksgiving Day'],
      ['2021-12-24', 'Christmas Day'], // Saturday 25 December 2021: observed on the Friday before, 5 U.S.C. 6103(b)
      // 2022: OPM 2022 Holiday Schedule
      ['2021-12-31', 'New Year’s Day'], // Saturday 1 January 2022: observed on the Friday before, 5 U.S.C. 6103(b); listed in OPM’s 2022 table
      ['2022-01-17', 'Birthday of Martin Luther King, Jr.'],
      ['2022-02-21', 'Washington’s Birthday'],
      ['2022-05-30', 'Memorial Day'],
      ['2022-06-20', 'Juneteenth National Independence Day'], // Sunday 19 June 2022: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2022-07-04', 'Independence Day'],
      ['2022-09-05', 'Labor Day'],
      ['2022-10-10', 'Columbus Day'],
      ['2022-11-11', 'Veterans Day'],
      ['2022-11-24', 'Thanksgiving Day'],
      ['2022-12-26', 'Christmas Day'], // Sunday 25 December 2022: observed on the Monday after, Executive Order 11582 s.3(a)
      // 2023: OPM 2023 Holiday Schedule
      ['2023-01-02', 'New Year’s Day'], // Sunday 1 January 2023: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2023-01-16', 'Birthday of Martin Luther King, Jr.'],
      ['2023-02-20', 'Washington’s Birthday'],
      ['2023-05-29', 'Memorial Day'],
      ['2023-06-19', 'Juneteenth National Independence Day'],
      ['2023-07-04', 'Independence Day'],
      ['2023-09-04', 'Labor Day'],
      ['2023-10-09', 'Columbus Day'],
      ['2023-11-10', 'Veterans Day'], // Saturday 11 November 2023: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2023-11-23', 'Thanksgiving Day'],
      ['2023-12-25', 'Christmas Day'],
      // 2024: OPM 2024 Holiday Schedule
      ['2024-01-01', 'New Year’s Day'],
      ['2024-01-15', 'Birthday of Martin Luther King, Jr.'],
      ['2024-02-19', 'Washington’s Birthday'],
      ['2024-05-27', 'Memorial Day'],
      ['2024-06-19', 'Juneteenth National Independence Day'],
      ['2024-07-04', 'Independence Day'],
      ['2024-09-02', 'Labor Day'],
      ['2024-10-14', 'Columbus Day'],
      ['2024-11-11', 'Veterans Day'],
      ['2024-11-28', 'Thanksgiving Day'],
      ['2024-12-25', 'Christmas Day'],
      // 2025: OPM 2025 Holiday Schedule
      ['2025-01-01', 'New Year’s Day'],
      ['2025-01-20', 'Birthday of Martin Luther King, Jr.'],
      ['2025-02-17', 'Washington’s Birthday'],
      ['2025-05-26', 'Memorial Day'],
      ['2025-06-19', 'Juneteenth National Independence Day'],
      ['2025-07-04', 'Independence Day'],
      ['2025-09-01', 'Labor Day'],
      ['2025-10-13', 'Columbus Day'],
      ['2025-11-11', 'Veterans Day'],
      ['2025-11-27', 'Thanksgiving Day'],
      ['2025-12-25', 'Christmas Day'],
      // 2026: OPM 2026 Holiday Schedule
      ['2026-01-01', 'New Year’s Day'],
      ['2026-01-19', 'Birthday of Martin Luther King, Jr.'],
      ['2026-02-16', 'Washington’s Birthday'],
      ['2026-05-25', 'Memorial Day'],
      ['2026-06-19', 'Juneteenth National Independence Day'],
      ['2026-07-03', 'Independence Day'], // Saturday 4 July 2026: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2026-09-07', 'Labor Day'],
      ['2026-10-12', 'Columbus Day'],
      ['2026-11-11', 'Veterans Day'],
      ['2026-11-26', 'Thanksgiving Day'],
      ['2026-12-25', 'Christmas Day'],
      // 2027: OPM 2027 Holiday Schedule
      ['2027-01-01', 'New Year’s Day'],
      ['2027-01-18', 'Birthday of Martin Luther King, Jr.'],
      ['2027-02-15', 'Washington’s Birthday'],
      ['2027-05-31', 'Memorial Day'],
      ['2027-06-18', 'Juneteenth National Independence Day'], // Saturday 19 June 2027: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2027-07-05', 'Independence Day'], // Sunday 4 July 2027: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2027-09-06', 'Labor Day'],
      ['2027-10-11', 'Columbus Day'],
      ['2027-11-11', 'Veterans Day'],
      ['2027-11-25', 'Thanksgiving Day'],
      ['2027-12-24', 'Christmas Day'], // Saturday 25 December 2027: observed on the Friday before, 5 U.S.C. 6103(b)
      // 2028: OPM 2028 Holiday Schedule
      ['2027-12-31', 'New Year’s Day'], // Saturday 1 January 2028: observed on the Friday before, 5 U.S.C. 6103(b); listed in OPM’s 2028 table
      ['2028-01-17', 'Birthday of Martin Luther King, Jr.'],
      ['2028-02-21', 'Washington’s Birthday'],
      ['2028-05-29', 'Memorial Day'],
      ['2028-06-19', 'Juneteenth National Independence Day'],
      ['2028-07-04', 'Independence Day'],
      ['2028-09-04', 'Labor Day'],
      ['2028-10-09', 'Columbus Day'],
      ['2028-11-10', 'Veterans Day'], // Saturday 11 November 2028: observed on the Friday before, 5 U.S.C. 6103(b)
      ['2028-11-23', 'Thanksgiving Day'],
      ['2028-12-25', 'Christmas Day'],
      // 2029: OPM 2029 Holiday Schedule
      ['2029-01-01', 'New Year’s Day'],
      ['2029-01-15', 'Birthday of Martin Luther King, Jr.'],
      ['2029-02-19', 'Washington’s Birthday'],
      ['2029-05-28', 'Memorial Day'],
      ['2029-06-19', 'Juneteenth National Independence Day'],
      ['2029-07-04', 'Independence Day'],
      ['2029-09-03', 'Labor Day'],
      ['2029-10-08', 'Columbus Day'],
      ['2029-11-12', 'Veterans Day'], // Sunday 11 November 2029: observed on the Monday after, Executive Order 11582 s.3(a)
      ['2029-11-22', 'Thanksgiving Day'],
      ['2029-12-25', 'Christmas Day'],
      // 2030: OPM 2030 Holiday Schedule
      ['2030-01-01', 'New Year’s Day'],
      ['2030-01-21', 'Birthday of Martin Luther King, Jr.'],
      ['2030-02-18', 'Washington’s Birthday'],
      ['2030-05-27', 'Memorial Day'],
      ['2030-06-19', 'Juneteenth National Independence Day'],
      ['2030-07-04', 'Independence Day'],
      ['2030-09-02', 'Labor Day'],
      ['2030-10-14', 'Columbus Day'],
      ['2030-11-11', 'Veterans Day'],
      ['2030-11-28', 'Thanksgiving Day'],
      ['2030-12-25', 'Christmas Day'],
      ]
    }
  };

  /* index each calendar by date once */
  var ids = Object.keys(CAL);
  for (var i = 0; i < ids.length; i++) {
    var c = CAL[ids[i]], map = {};
    for (var k = 0; k < c.days.length; k++) map[c.days[k][0]] = c.days[k][1];
    c.byDate = map;
  }

  root.HOLIDAYS = {
    calendars: CAL,
    ids: ids,
    /* the holiday on that date in that calendar, or '' */
    name: function (id, iso) {
      var c = CAL[id];
      return c && Object.prototype.hasOwnProperty.call(c.byDate, iso) ? c.byDate[iso] : '';
    },
    /* [date, name] pairs from a to b inclusive (ISO strings) */
    list: function (id, a, b) {
      var c = CAL[id], out = [];
      if (!c) return out;
      for (var k = 0; k < c.days.length; k++) if (c.days[k][0] >= a && c.days[k][0] <= b) out.push(c.days[k].slice());
      return out.sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
    }
  };
})();
