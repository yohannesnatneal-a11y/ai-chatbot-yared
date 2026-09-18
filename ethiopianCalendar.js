/**
 * Ethiopian Calendar (የኢትዮጵያ ዘመን አቆጣጠር) Utility
 * Accurate Beyene-Kudlek algorithm for conversion between Ethiopian and Gregorian calendars.
 */

export const AMETE_MIHRET = 1723856;
const GREGORIAN_EPOCH = 1721426;

const floorDiv = (a, b) => Math.floor(a / b);

const isGregorianLeap = (year) =>
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const MONTH_DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const pagumeDays = (year) => (year % 4 === 3 ? 6 : 5);

export const ETHIOPIAN_MONTHS = [
    { am: "መስከረም", en: "Meskerem" },
    { am: "ጥቅምት", en: "Tikimt" },
    { am: "ኅዳር", en: "Hidar" },
    { am: "ታኅሣሥ", en: "Tahsas" },
    { am: "ጥር", en: "Tir" },
    { am: "የካቲት", en: "Yekatit" },
    { am: "መጋቢት", en: "Megabit" },
    { am: "ሚያዝያ", en: "Miyazya" },
    { am: "ግንቦት", en: "Ginbot" },
    { am: "ሰኔ", en: "Sene" },
    { am: "ሐምሌ", en: "Hamle" },
    { am: "ነሐሴ", en: "Nehase" },
    { am: "ጳጉሜ", en: "Pagume" },
];

export const ETHIOPIAN_WEEKDAYS = [
    { am: "እሑድ", en: "Sunday" },
    { am: "ሰኞ", en: "Monday" },
    { am: "ማክሰኞ", en: "Tuesday" },
    { am: "ረቡዕ", en: "Wednesday" },
    { am: "ሐሙስ", en: "Thursday" },
    { am: "ዓርብ", en: "Friday" },
    { am: "ቅዳሜ", en: "Saturday" },
];

export const ETHIOPIAN_HOLIDAYS = [
    { month: 1, day: 1, nameAm: "እንቁጣጣሽ (አዲስ ዓመት)", nameEn: "Enkutatash (Ethiopian New Year)" },
    { month: 1, day: 17, nameAm: "መስቀል (ደመራ)", nameEn: "Meskel (Finding of the True Cross)" },
    { month: 4, day: 29, nameAm: "ገና (የገና በዓል)", nameEn: "Genna (Ethiopian Christmas)" },
    { month: 5, day: 11, nameAm: "ጥምቀት", nameEn: "Timkat (Epiphany)" },
    { month: 6, day: 23, nameAm: "የአድዋ ድል በዓል", nameEn: "Victory of Adwa Day" },
    { month: 8, day: 23, nameAm: "የአርበኞች ቀን", nameEn: "Patriots' Victory Day" },
    { month: 9, day: 20, nameAm: "ደርግ የወደቀበት ቀን (ግንቦት 20)", nameEn: "Ginbot 20 (Downfall of the Derg)" },
];

function ethiopicToJdn(year, month, day, era = AMETE_MIHRET) {
    return (
        era +
        365 +
        365 * (year - 1) +
        floorDiv(year, 4) +
        30 * month +
        day -
        31
    );
}

function jdnToEthiopic(jdn) {
    const era = AMETE_MIHRET;
    const r = (jdn - era) % 1461;
    const n = (r % 365) + 365 * floorDiv(r, 1460);
    const year =
        4 * floorDiv(jdn - era, 1461) +
        floorDiv(r, 365) -
        floorDiv(r, 1460);
    const month = floorDiv(n, 30) + 1;
    const day = (n % 30) + 1;
    return [year, month, day];
}

function gregorianToJdn(year, month, day) {
    const s =
        floorDiv(year, 4) -
        floorDiv(year - 1, 4) -
        floorDiv(year, 100) +
        floorDiv(year - 1, 100) +
        floorDiv(year, 400) -
        floorDiv(year - 1, 400);
    const t = floorDiv(14 - month, 12);
    const n =
        31 * t * (month - 1) +
        (1 - t) *
            (59 + s + 30 * (month - 3) + floorDiv(3 * month - 7, 5)) +
        day -
        1;
    return (
        GREGORIAN_EPOCH +
        365 * (year - 1) +
        floorDiv(year - 1, 4) -
        floorDiv(year - 1, 100) +
        floorDiv(year - 1, 400) +
        n
    );
}

function jdnToGregorian(jdn) {
    const r400 = (jdn - GREGORIAN_EPOCH) % 146097;
    const century = Math.min(floorDiv(r400, 36524), 3);
    const r100 = r400 - century * 36524;
    const r4 = r100 % 1461;
    let n = (r4 % 365) + 365 * floorDiv(r4, 1460);
    const year =
        400 * floorDiv(jdn - GREGORIAN_EPOCH, 146097) +
        100 * century +
        4 * floorDiv(r100, 1461) +
        floorDiv(r4, 365) -
        floorDiv(r4, 1460) +
        1;
    n += 1;

    let month = 1;
    for (let m = 1; m <= 12; m += 1) {
        const daysInM =
            m === 2 && isGregorianLeap(year) ? 29 : MONTH_DAYS[m];
        if (n <= daysInM) {
            month = m;
            break;
        }
        n -= daysInM;
    }
    return [year, month, n];
}

export function toEthiopian(date = new Date()) {
    const gYear = date.getFullYear();
    const gMonth = date.getMonth() + 1;
    const gDay = date.getDate();
    const jdn = gregorianToJdn(gYear, gMonth, gDay);
    const [ethYear, ethMonth, ethDay] = jdnToEthiopic(jdn);
    const dayOfWeek = date.getDay();

    const monthInfo = ETHIOPIAN_MONTHS[ethMonth - 1] || { am: "", en: "" };
    const weekdayInfo = ETHIOPIAN_WEEKDAYS[dayOfWeek] || { am: "", en: "" };

    const holiday = ETHIOPIAN_HOLIDAYS.find(
        (h) => h.month === ethMonth && h.day === ethDay
    );

    return {
        year: ethYear,
        month: ethMonth,
        day: ethDay,
        monthNameAm: monthInfo.am,
        monthNameEn: monthInfo.en,
        weekdayAm: weekdayInfo.am,
        weekdayEn: weekdayInfo.en,
        holidayAm: holiday ? holiday.nameAm : null,
        holidayEn: holiday ? holiday.nameEn : null,
        formattedAm: `${weekdayInfo.am}፣ ${monthInfo.am} ${ethDay} ቀን ${ethYear} ዓ.ም`,
        formattedEn: `${weekdayInfo.en}, ${monthInfo.en} ${ethDay}, ${ethYear} E.C.`,
    };
}

export function toGregorian(year, month, day) {
    const jdn = ethiopicToJdn(year, month, day);
    const [gYear, gMonth, gDay] = jdnToGregorian(jdn);
    return { year: gYear, month: gMonth, day: gDay };
}
