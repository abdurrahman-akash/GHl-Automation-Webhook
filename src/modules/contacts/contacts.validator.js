import { normalizeText, parseFullAddress } from "../../common/utils/address.js";

function normalizeInboundValue(value) {
  const normalized = normalizeText(value);

  // Ignore unresolved GHL template tokens like {{contact.phone}}
  if (/^\{\{[^{}]+\}\}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function pickFirstNormalizedValue(values = []) {
  for (const value of values) {
    const normalized = normalizeInboundValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function normalizeCheckDuplicateBusinessPayload(body = {}) {
  const fullAddress = normalizeText(body.fullAddress || body.full_address);
  const parsedAddress = parseFullAddress(fullAddress);

  return {
    businessName: normalizeText(body.businessName),
    fullAddress,
    address: normalizeText(body.address || body.address1 || body.streetaddress) || parsedAddress.address,
    city: normalizeText(body.city) || parsedAddress.city,
    state: normalizeText(body.state) || parsedAddress.state,
    country: normalizeText(body.country) || parsedAddress.country,
    postalCode: normalizeText(
      body.postalCode || body.postal_code || body.zip || body.zipCode || body["Postal Code"]
    ) || parsedAddress.postalCode,
    id: normalizeText(body.id)
  };
}

export function hasBusinessName(payload) {
  return Boolean(payload.businessName);
}

export function hasStreetAddress(payload) {
  return Boolean(payload.address);
}

export function hasCity(payload) {
  return Boolean(payload.city);
}

export function hasFullBusinessAddress(payload) {
  return Boolean(payload.fullAddress || payload.address || payload.city);
}

export function normalizeCheckDuplicatePhoneEmailPayload(body = {}) {
  const contact = body.contact || {};
  const customData = body.customData || body.custom_data || {};
  const customDataContact = customData.contact || {};

  return {
    phone: pickFirstNormalizedValue([
      body.phone,
      body.number,
      body.phoneNumber,
      body.phone_number,
      body.mobile,
      body.mobileNumber,
      body.mobile_number,
      body.contactPhone,
      body["contact.phone"],
      body["contact.number"],
      customData.phone,
      customData.number,
      customData.mobile,
      customDataContact.phone,
      customDataContact.number,
      body.Phone,
      contact.phone,
      contact.number,
      contact.phoneNumber,
      contact.phone_number,
      contact.mobile,
      contact.mobileNumber,
      contact.mobile_number
    ]),
    email: pickFirstNormalizedValue([
      body.email,
      body.emailAddress,
      body.email_address,
      body["contact.email"],
      customData.email,
      customData.emailAddress,
      customData.email_address,
      customDataContact.email,
      customDataContact.emailAddress,
      customDataContact.email_address,
      body.Email,
      contact.email,
      contact.emailAddress,
      contact.email_address
    ]),
    id: pickFirstNormalizedValue([
      body.id,
      body.contactId,
      body.contact_id,
      body["contact.id"],
      customData.id,
      customData.contactId,
      customData.contact_id,
      customDataContact.id,
      contact.id
    ])
  };
}

export function hasPhoneOrEmail(payload) {
  return Boolean(payload.phone || payload.email);
}
