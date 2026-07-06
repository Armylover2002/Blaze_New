import { listPublicParcelVehicles } from './vehicle.service.js';
import { listPublicOfferBanners } from './banner.service.js';
import { listPublicCoupons } from './coupon.service.js';

export async function getPublicHomeData() {
    const [vehicles, banners, coupons] = await Promise.all([
        listPublicParcelVehicles(),
        listPublicOfferBanners(),
        listPublicCoupons(),
    ]);

    return { vehicles, banners, coupons };
}
