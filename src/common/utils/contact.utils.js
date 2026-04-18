function normalizeAddressValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export function getPrimaryAddressRecord(record = {}) {
  if (Array.isArray(record?.addresses) && record.addresses.length > 0) {
    return record.addresses[0] || {};
  }

  return {};
}

export function deduplicateContacts(contacts) {
  const contactMap = new Map();

  for (const contact of contacts) {
    if (!contact) {
      continue;
    }

    const fallbackKey = `${contact.email || ""}:${contact.phone || contact.number || ""}`;
    const key = String(contact.id || fallbackKey);

    if (!contactMap.has(key)) {
      contactMap.set(key, contact);
    }
  }

  return Array.from(contactMap.values());
}

export function excludeCurrentContact(matches, id) {
  if (!id) {
    return matches;
  }

  const normalizedId = String(id);
  return matches.filter((contact) => String(contact?.id) !== normalizedId);
}

export function resolveFieldStatus(contact, id, requested) {
  if (!requested) {
    return null;
  }

  if (!contact) {
    return "null";
  }

  if (id && String(contact.id) === String(id)) {
    return "unique";
  }

  return "duplicate";
}

export function computeTopStatus(statuses) {
  if (statuses.every((status) => status === null || status === "null")) {
    return "null";
  }

  if (statuses.includes("duplicate")) {
    return "duplicate";
  }

  return "unique";
}

function resolveFullAddressText(record = {}) {
  const primaryAddress = getPrimaryAddressRecord(record);
  return normalizeAddressValue(
    record.fullAddress ||
      record.full_address ||
      primaryAddress.fullAddress ||
      primaryAddress.full_address
  );
}

function resolvePostalCode(record = {}) {
  const primaryAddress = getPrimaryAddressRecord(record);

  return normalizeAddressValue(
    record.postalCode ||
      record.postal_code ||
      record.zipCode ||
      record.zip ||
      record.zipcode ||
      record["Postal Code"] ||
      primaryAddress.postalCode ||
      primaryAddress.postal_code ||
      primaryAddress.zipCode ||
      primaryAddress.zip ||
      primaryAddress.zipcode ||
      primaryAddress["Postal Code"]
  );
}

export function toAddressItem(record = {}) {
  const primaryAddress = getPrimaryAddressRecord(record);
  const fullAddress = resolveFullAddressText(record);

  const item = {
    streetaddress: normalizeAddressValue(
      record.address ||
        record.address1 ||
        record.streetAddress ||
        record.streetaddress ||
        primaryAddress.address ||
        primaryAddress.address1 ||
        primaryAddress.street ||
        primaryAddress.streetAddress ||
        primaryAddress.streetaddress
    ),
    city: normalizeAddressValue(record.city || primaryAddress.city),
    country: normalizeAddressValue(record.country || primaryAddress.country),
    state: normalizeAddressValue(record.state || primaryAddress.state),
    "Postal Code": resolvePostalCode(record),
    full_address: fullAddress
  };

  if (!item.full_address) {
    item.full_address = [
      item.streetaddress,
      item.city,
      item.state,
      item["Postal Code"],
      item.country
    ]
      .filter(Boolean)
      .join(", ");
  }

  if (
    !item.streetaddress &&
    !item.city &&
    !item.country &&
    !item.state &&
    !item["Postal Code"] &&
    !item.full_address
  ) {
    return null;
  }

  return item;
}

export function deduplicateAddressItems(items) {
  const addressMap = new Map();

  for (const item of items) {
    if (!item) {
      continue;
    }

    const key = [item.streetaddress, item.city, item.country]
      .map((value) => normalizeAddressValue(value).toLowerCase())
      .join("|");

    if (!addressMap.has(key)) {
      addressMap.set(key, item);
    }
  }

  return Array.from(addressMap.values());
}
