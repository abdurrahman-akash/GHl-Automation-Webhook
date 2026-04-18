export function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeAddressPart(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildFullAddress(contact = {}) {
  const parts = [
    normalizeAddressPart(contact.address || contact.address1),
    normalizeAddressPart(contact.city),
    normalizeAddressPart(contact.state),
    normalizeAddressPart(contact.country)
  ].filter(Boolean);

  return parts.join(", ");
}

export function parseFullAddress(fullAddress) {
  const normalized = normalizeText(fullAddress);
  if (!normalized) {
    return {
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: ""
    };
  }

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: ""
    };
  }

  let country = "";
  let state = "";
  let postalCode = "";

  const lastPart = parts[parts.length - 1] || "";
  if (/^[A-Za-z]{2,3}$/.test(lastPart)) {
    country = lastPart.toUpperCase();
    parts.pop();
  }

  const stateZipPart = parts[parts.length - 1] || "";
  const stateZipMatch = stateZipPart.match(/^([A-Za-z]{2})\s+([A-Za-z0-9-]{3,10})$/);
  if (stateZipMatch) {
    state = stateZipMatch[1].toUpperCase();
    postalCode = stateZipMatch[2];
    parts.pop();
  } else if (/^[A-Za-z]{2}$/.test(stateZipPart)) {
    state = stateZipPart.toUpperCase();
    parts.pop();
  }

  if (!postalCode) {
    const possibleZip = parts[parts.length - 1] || "";
    if (/^[A-Za-z0-9-]{3,10}$/.test(possibleZip) && /\d/.test(possibleZip)) {
      postalCode = possibleZip;
      parts.pop();
    }
  }

  const city = parts.length > 0 ? parts.pop() : "";
  const address = parts.join(", ");

  return {
    address,
    city,
    state,
    country,
    postalCode
  };
}
