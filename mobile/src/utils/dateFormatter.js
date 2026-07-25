export const formatDateDDMMYYYY = (dateStrOrObj) => {
  if (!dateStrOrObj) return '';
  try {
    const d = new Date(dateStrOrObj);
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return String(dateStrOrObj);
  }
};
