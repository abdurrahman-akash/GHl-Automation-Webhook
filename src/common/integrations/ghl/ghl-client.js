import axios from "axios";
import { GhlServiceError } from "../../errors/ghl-service.error.js";

const GHL_VERSION = "2021-07-28";
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_BASE_URL = "https://services.leadconnectorhq.com";

function getBaseUrl() {
  return process.env.GHL_BASE_URL || DEFAULT_BASE_URL;
}

function toErrorMessage(error, fallback = "Unknown GHL error") {
  return error?.response?.data?.message || error?.message || fallback;
}

function extractContacts(searchResponseData) {
  if (Array.isArray(searchResponseData?.contacts)) {
    return searchResponseData.contacts;
  }

  if (Array.isArray(searchResponseData?.data?.contacts)) {
    return searchResponseData.data.contacts;
  }

  if (Array.isArray(searchResponseData?.results)) {
    return searchResponseData.results;
  }

  return [];
}

function extractSingleContact(duplicateResponseData) {
  if (duplicateResponseData?.contact) {
    return duplicateResponseData.contact;
  }

  if (duplicateResponseData?.data?.contact) {
    return duplicateResponseData.data.contact;
  }

  return null;
}

function buildHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json"
  };
}

function handleRequestError(error, logPrefix, context = {}) {
  if (error.response) {
    console.error(`[${logPrefix}] GHL response error`, {
      status: error.response.status,
      message: toErrorMessage(error),
      ...context
    });
    throw new GhlServiceError("Failed to fetch contacts from GHL", 502);
  }

  if (error.request) {
    console.error(`[${logPrefix}] GHL network error`, {
      message: error.message,
      ...context
    });
    throw new GhlServiceError("Network error while contacting GHL API", 502);
  }

  console.error(`[${logPrefix}] Unexpected GHL service error`, {
    message: error.message,
    ...context
  });
  throw new GhlServiceError("Unexpected error while contacting GHL API", 500);
}

export async function searchDuplicateByField({ apiKey, locationId, fieldKey, fieldValue }) {
  const endpoint = `${getBaseUrl()}/contacts/search/duplicate`;

  try {
    const response = await axios.get(endpoint, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: buildHeaders(apiKey),
      params: {
        locationId,
        [fieldKey]: fieldValue
      }
    });

    return {
      data: response.data,
      contact: extractSingleContact(response.data)
    };
  } catch (error) {
    handleRequestError(error, "duplicate-contact", {
      locationId,
      fieldKey
    });
  }
}

export async function searchContactsPage({ apiKey, locationId, page = 1, pageLimit = 100, query = "" }) {
  const endpoint = `${getBaseUrl()}/contacts/search`;
  const payload = {
    locationId,
    page,
    pageLimit,
    ...(query ? { query } : {})
  };

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: buildHeaders(apiKey)
    });

    const contacts = extractContacts(response.data);

    return {
      contacts,
      meta: {
        page,
        pageLimit,
        total: Number(response.data?.total || response.data?.meta?.total || contacts.length)
      }
    };
  } catch (error) {
    handleRequestError(error, "get-all-contacts", {
      locationId,
      page,
      pageLimit
    });
  }
}

export async function searchContactsByFilters({ apiKey, locationId, filters, page = 1, pageLimit = 100 }) {
  const endpoint = `${getBaseUrl()}/contacts/search`;
  const payload = {
    locationId,
    page,
    pageLimit,
    filters
  };

  try {
    const response = await axios.post(endpoint, payload, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: buildHeaders(apiKey)
    });

    return extractContacts(response.data);
  } catch (error) {
    handleRequestError(error, "search-contacts", {
      locationId,
      hasFilters: Array.isArray(filters) && filters.length > 0
    });
  }
}
