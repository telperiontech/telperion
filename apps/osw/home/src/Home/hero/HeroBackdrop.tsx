/** Soft, static color washes behind the hero: primary, secondary and tertiary. */
export function HeroBackdrop() {
	return (
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
			<div className="absolute -top-48 left-[10%] size-[32rem] rounded-full bg-radial from-primary-200 to-transparent to-70%" />
			<div className="absolute -top-56 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-radial from-secondary-200 to-transparent to-70%" />
			<div className="absolute -top-32 right-[8%] size-[28rem] rounded-full bg-radial from-tertiary-200 to-transparent to-70%" />
		</div>
	);
}
