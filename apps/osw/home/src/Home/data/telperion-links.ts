const SITE = 'https://telperion.tr/en';

export const telperionLinks = {
	home: `${SITE}/`,
	openSource: `${SITE}/open-source/`,
	products: `${SITE}/products/`,
	services: `${SITE}/services/`,
	about: `${SITE}/about/`,
	blog: `${SITE}/blog/`,
	careers: `${SITE}/careers/`,
	contact: `${SITE}/contact/`,
} as const;

export const companyNav = [
	{ label: 'Products', href: telperionLinks.products },
	{ label: 'Services', href: telperionLinks.services },
	{ label: 'About', href: telperionLinks.about },
	{ label: 'Blog', href: telperionLinks.blog },
	{ label: 'Careers', href: telperionLinks.careers },
	{ label: 'Contact', href: telperionLinks.contact },
];
