export function isDuplicateEntry(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if ('code' in error && error.code === 'ER_DUP_ENTRY') {
    return true;
  }

  if ('driverError' in error) {
    const driverError = error.driverError;
    return (
      typeof driverError === 'object' &&
      driverError !== null &&
      'code' in driverError &&
      driverError.code === 'ER_DUP_ENTRY'
    );
  }

  return false;
}
