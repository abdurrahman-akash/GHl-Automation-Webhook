import { GhlServiceError } from "../../common/errors/ghl-service.error.js";
import {
  computeTopStatus,
  deduplicateAddressItems,
  deduplicateContacts,
  excludeCurrentContact,
  resolveFieldStatus,
  toAddressItem
} from "../../common/utils/contact.utils.js";
import {
  hasBusinessName,
  hasCity,
  hasFullBusinessAddress,
  hasPhoneOrEmail,
  hasStreetAddress,
  normalizeCheckDuplicateBusinessPayload,
  normalizeCheckDuplicatePhoneEmailPayload
} from "./contacts.validator.js";
import {
  getAllContacts,
  searchContactsByAddress,
  searchContactsByBusinessName,
  searchDuplicateContactByPhoneEmail
} from "./contacts.service.js";

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveContextOrSendError(req, res) {
  if (req.authContext?.locationId && req.authContext?.apiKey) {
    return req.authContext;
  }

  res.status(500).json({ message: "Auth context missing in request" });
  return null;
}

async function runPhoneEmailDuplicateCheck(context, payload) {
  if (!hasPhoneOrEmail(payload)) {
    return {
      statusCode: 200,
      body: {
        status: "null",
        count: 0
      }
    };
  }

  const lookupResult = await searchDuplicateContactByPhoneEmail({
    apiKey: context.apiKey,
    locationId: context.locationId,
    phone: payload.phone,
    email: payload.email
  });

  const phoneStatus = resolveFieldStatus(lookupResult.phoneContact, payload.id, Boolean(payload.phone));
  const emailStatus = resolveFieldStatus(lookupResult.emailContact, payload.id, Boolean(payload.email));

  const combinedMatches = deduplicateContacts(
    excludeCurrentContact(
      [lookupResult.phoneContact, lookupResult.emailContact].filter(Boolean),
      payload.id
    )
  );

  return {
    statusCode: 200,
    body: {
      status: computeTopStatus([phoneStatus, emailStatus]),
      count: combinedMatches.length,
      phoneStatus,
      emailStatus
    }
  };
}

export async function checkDuplicateBusinessController(req, res) {
  const context = resolveContextOrSendError(req, res);
  if (!context) {
    return undefined;
  }

  const payload = normalizeCheckDuplicateBusinessPayload(req.body || {});
  const shouldCheckBusinessName = hasBusinessName(payload);
  const shouldCheckAddress = hasFullBusinessAddress(payload);
  const shouldCheckStreetAddress = hasStreetAddress(payload);
  const shouldCheckCity = hasCity(payload);

  if (!shouldCheckBusinessName && !shouldCheckAddress) {
    return res.status(200).json({
      status: "null",
      count: 0,
      businessNameStatus: "null",
      addressStatus: "null",
      streetAddressStatus: "null",
      cityStatus: "null",
      streetAddressCount: 0,
      cityCount: 0,
      address: []
    });
  }

  try {
    const [businessNameMatches, addressSearchResult] = await Promise.all([
      shouldCheckBusinessName
        ? searchContactsByBusinessName({
            ...payload,
            locationId: context.locationId,
            apiKey: context.apiKey
          })
        : Promise.resolve([]),
      shouldCheckAddress
        ? searchContactsByAddress({
            ...payload,
            locationId: context.locationId,
            apiKey: context.apiKey
          })
        : Promise.resolve({
            streetMatches: [],
            cityMatches: [],
            addressMatches: []
          })
    ]);

    const filteredBusinessNameMatches = excludeCurrentContact(businessNameMatches, payload.id);
    const filteredStreetAddressMatches = deduplicateContacts(
      excludeCurrentContact(addressSearchResult.streetMatches || [], payload.id)
    );
    const filteredCityMatches = deduplicateContacts(
      excludeCurrentContact(addressSearchResult.cityMatches || [], payload.id)
    );
    const filteredAddressMatches = deduplicateContacts(
      excludeCurrentContact(addressSearchResult.addressMatches || [], payload.id)
    );
    const allMatches = deduplicateContacts([
      ...filteredBusinessNameMatches,
      ...filteredStreetAddressMatches,
      ...filteredCityMatches
    ]);

    const businessNameStatus = shouldCheckBusinessName
      ? (filteredBusinessNameMatches.length > 0 ? "duplicate" : "unique")
      : "null";
    const streetAddressStatus = shouldCheckAddress
      ? (shouldCheckStreetAddress
          ? (filteredStreetAddressMatches.length > 0 ? "duplicate" : "unique")
          : "null")
      : "null";
    const cityStatus = shouldCheckAddress
      ? (shouldCheckCity ? (filteredCityMatches.length > 0 ? "duplicate" : "unique") : "null")
      : "null";
    const addressStatus = shouldCheckAddress
      ? (streetAddressStatus === "duplicate" && cityStatus === "duplicate"
          ? "duplicate"
          : "unique")
      : "null";
    const streetAddressCount = shouldCheckStreetAddress ? filteredStreetAddressMatches.length : 0;
    const cityCount = shouldCheckCity ? filteredCityMatches.length : 0;

    const addressItems = shouldCheckAddress
      ? deduplicateAddressItems(
          (filteredAddressMatches.length > 0 ? filteredAddressMatches : [payload])
            .map((item) => toAddressItem(item))
            .filter(Boolean)
        )
      : [];

    return res.status(200).json({
      status: computeTopStatus([businessNameStatus, addressStatus]),
      count: allMatches.length,
      businessNameStatus,
      addressStatus,
      streetAddressStatus,
      cityStatus,
      streetAddressCount,
      cityCount,
      address: addressItems
    });
  } catch (error) {
    if (error instanceof GhlServiceError) {
      return res.status(error.statusCode).json({
        message: error.message
      });
    }

    console.error("Unexpected error in duplicate business controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function checkDuplicatePhoneEmailController(req, res) {
  const context = resolveContextOrSendError(req, res);
  if (!context) {
    return undefined;
  }

  try {
    const payload = normalizeCheckDuplicatePhoneEmailPayload(req.body || {});
    const result = await runPhoneEmailDuplicateCheck(context, payload);
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    if (error instanceof GhlServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unexpected error in duplicate contact controller:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAllContactsController(req, res) {
  const context = resolveContextOrSendError(req, res);
  if (!context) {
    return undefined;
  }

  const page = normalizePositiveInteger(req.body?.page, 1);
  const pageLimit = Math.min(normalizePositiveInteger(req.body?.pageLimit, 100), 100);
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";

  try {
    const result = await getAllContacts({
      locationId: context.locationId,
      apiKey: context.apiKey,
      page,
      pageLimit,
      query
    });

    return res.status(200).json({
      status: "success",
      count: result.contacts.length,
      contacts: result.contacts,
      page: result.meta.page,
      pageLimit: result.meta.pageLimit,
      total: result.meta.total
    });
  } catch (error) {
    if (error instanceof GhlServiceError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unexpected error in get-all-contacts handler:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
