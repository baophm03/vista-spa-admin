/**
 * Tên hiển thị của khách/nhân sự: ưu tiên full_name, fallback zalo_name
 * (user đăng ký qua Zalo thường không có full_name — tên nằm ở zalo_name).
 */
export function displayName(
	profile?: { full_name?: string | null; zalo_name?: string | null; name?: string | null } | null,
	fallback = '—',
): string {
	const name =
		profile?.full_name?.trim() ||
		profile?.zalo_name?.trim() ||
		profile?.name?.trim() ||
		'';
	return name || fallback;
}
