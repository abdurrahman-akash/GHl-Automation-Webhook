import { buildFullAddress } from "../../common/utils/address.js";
import { getPrimaryAddressRecord } from "../../common/utils/contact.utils.js";
import {
  searchContactsByFilters,
  searchContactsPage,
  searchDuplicateByField
} from "../../common/integrations/ghl/ghl-client.js";

const CONTACT_PAGE_LIMIT = 100;
const MAX_CONTACT_SEARCH_PAGES = 50;

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAddressFingerprint(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTokenFingerprint(value) {
  const tokens = normalizeAddressFingerprint(value)
    .split(" ")
    .filter(Boolean)
    .sort();

  return tokens.join(" ");
}

function isEquivalentAddress(candidate, target) {
  const candidateSeq = normalizeAddressFingerprint(candidate);
  const targetSeq = normalizeAddressFingerprint(target);

  if (!candidateSeq || !targetSeq) {
    return false;
  }

  if (candidateSeq === targetSeq) {
    return true;
  }

  return buildTokenFingerprint(candidate) === buildTokenFingerprint(target);
}

function getStreetAddress(contact = {}) {
  const primaryAddress = getPrimaryAddressRecord(contact);
  return (
    contact?.address ||
    contact?.address1 ||
    contact?.streetAddress ||
    contact?.streetaddress ||
    primaryAddress?.address ||
    primaryAddress?.address1 ||
    primaryAddress?.street ||
    primaryAddress?.streetAddress ||
    primaryAddress?.streetaddress
  );
}

function getCity(contact = {}) {
  const primaryAddress = getPrimaryAddressRecord(contact);
  return contact?.city || primaryAddress?.city;
}

function isExactBusinessNameMatch(contact, businessName) {
  return normalizeValue(contact?.companyName) === normalizeValue(businessName);
}

function isStreetAddressMatch(contact, target) {
  const targetStreetAddress = String(target?.address || "").trim();
  const contactStreetAddress = String(getStreetAddress(contact) || "").trim();

  if (!targetStreetAddress || !contactStreetAddress) {
    return false;
  }

  return isEquivalentAddress(contactStreetAddress, targetStreetAddress);
}

function isCityMatch(contact, target) {
  const targetCity = normalizeValue(target?.city);

  if (!targetCity) {
    return false;
  }

  return normalizeValue(getCity(contact)) === targetCity;
}

export async function searchDuplicateContactByPhoneEmail(criteria) {
  const tasks = [];

  if (criteria.phone) {
    tasks.push(
      searchDuplicateByField({
        apiKey: criteria.apiKey,
        locationId: criteria.locationId,
        fieldKey: "number",
        fieldValue: criteria.phone
      }).then((result) => ({ field: "phone", result }))
    );
  }

  if (criteria.email) {
    tasks.push(
      searchDuplicateByField({
        apiKey: criteria.apiKey,
        locationId: criteria.locationId,
        fieldKey: "email",
        fieldValue: criteria.email
      }).then((result) => ({ field: "email", result }))
    );
  }

  const results = await Promise.all(tasks);

  const phoneResult = results.find((item) => item.field === "phone")?.result || null;
  const emailResult = results.find((item) => item.field === "email")?.result || null;

  return {
    phoneData: phoneResult?.data || null,
    emailData: emailResult?.data || null,
    phoneContact: phoneResult?.contact || null,
    emailContact: emailResult?.contact || null
  };
}

export async function searchContactsByBusinessName(criteria) {
  const filters = [
    {
      field: "companyName",
      operator: "eq",
      value: criteria.businessName
    }
  ];

  console.info("[duplicate-business-name] GHL search request", {
    locationId: criteria.locationId,
    businessName: criteria.businessName
  });

  const contacts = await searchContactsByFilters({
    apiKey: criteria.apiKey,
    locationId: criteria.locationId,
    filters
  });

  const exactMatches = contacts.filter((contact) =>
    isExactBusinessNameMatch(contact, criteria.businessName)
  );

  console.info("[duplicate-business-name] GHL search response", {
    locationId: criteria.locationId,
    totalContactsReturned: contacts.length,
    exactMatches: exactMatches.length
  });

  return exactMatches;
}

export async function getAllContacts(criteria) {
  console.info("[get-all-contacts] GHL search request", {
    locationId: criteria.locationId,
    page: criteria.page,
    pageLimit: criteria.pageLimit,
    hasQuery: Boolean(criteria.query)
  });

  return searchContactsPage({
    apiKey: criteria.apiKey,
    locationId: criteria.locationId,
    page: criteria.page,
    pageLimit: criteria.pageLimit,
    query: criteria.query
  });
}

export async function searchContactsByAddress(criteria) {
  console.info("[duplicate-business-address] GHL search request", {
    locationId: criteria.locationId,
    targetAddress: criteria.fullAddress || [criteria.address, criteria.city, criteria.country]
      .filter(Boolean)
      .join(", ")
  });

  const contacts = [];
  let page = 1;

  while (page <= MAX_CONTACT_SEARCH_PAGES) {
    const pageResult = await getAllContacts({
      apiKey: criteria.apiKey,
      locationId: criteria.locationId,
      page,
      pageLimit: CONTACT_PAGE_LIMIT,
      query: ""
    });

    if (!Array.isArray(pageResult.contacts) || pageResult.contacts.length === 0) {
      break;
    }

    contacts.push(...pageResult.contacts);

    if (pageResult.contacts.length < CONTACT_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  const shouldCheckStreetAddress = Boolean(String(criteria.address || "").trim());
  const shouldCheckCity = Boolean(String(criteria.city || "").trim());

  const streetMatches = [];
  const cityMatches = [];
  const bothMatches = [];

  for (const contact of contacts) {
    const streetMatch = shouldCheckStreetAddress ? isStreetAddressMatch(contact, criteria) : false;
    const cityMatch = shouldCheckCity ? isCityMatch(contact, criteria) : false;

    if (streetMatch) {
      streetMatches.push(contact);
    }

    if (cityMatch) {
      cityMatches.push(contact);
    }

    if (streetMatch && cityMatch) {
      bothMatches.push(contact);
    }
  }

  const addressMatches = shouldCheckStreetAddress && shouldCheckCity
    ? bothMatches
    : shouldCheckStreetAddress
      ? streetMatches
      : shouldCheckCity
        ? cityMatches
        : [];

  console.info("[duplicate-business-address] GHL search response", {
    locationId: criteria.locationId,
    totalContactsScanned: contacts.length,
    streetMatches: streetMatches.length,
    cityMatches: cityMatches.length,
    addressMatches: addressMatches.length,
    sampleAddress: buildFullAddress(addressMatches[0] || {})
  });

  return {
    streetMatches,
    cityMatches,
    addressMatches
  };
}
