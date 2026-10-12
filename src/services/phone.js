function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function phoneVariants(input) {
  const digits = digitsOnly(input);
  const variants = new Set([String(input || '').trim(), digits]);

  if (digits.startsWith('972') && digits.length > 3) {
    const local = digits.slice(3);
    variants.add(local);
    variants.add(`0${local}`);
    variants.add(`+972${local}`);
    variants.add(`972${local}`);
  }

  if (digits.startsWith('0') && digits.length > 1) {
    const withoutZero = digits.slice(1);
    variants.add(withoutZero);
    variants.add(`972${withoutZero}`);
    variants.add(`+972${withoutZero}`);
  }

  if (!digits.startsWith('0') && !digits.startsWith('972') && digits.length >= 8) {
    variants.add(`0${digits}`);
    variants.add(`972${digits}`);
    variants.add(`+972${digits}`);
  }

  return [...variants].filter(Boolean);
}

async function findUserByPhone(prisma, input) {
  const variants = phoneVariants(input);
  const digits = digitsOnly(input);

  const exact = await prisma.user.findFirst({
    where: {
      OR: [
        { phoneNumber: { in: variants } },
        ...(digits ? [{ phoneNumber: digits }, { phoneNumber: `+${digits}` }] : []),
      ],
    },
  });
  if (exact) return exact;

  const users = await prisma.user.findMany();
  return users.find((user) => {
    const combined = digitsOnly(`${user.countryCode || ''}${user.phoneNumber || ''}`);
    const phoneDigits = digitsOnly(user.phoneNumber);
    return (
      combined === digits ||
      phoneDigits === digits ||
      (digits.endsWith(phoneDigits) && phoneDigits.length >= 8) ||
      (phoneDigits.endsWith(digits) && digits.length >= 8)
    );
  }) || null;
}

module.exports = { digitsOnly, phoneVariants, findUserByPhone };
