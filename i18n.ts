import {getRequestConfig} from 'next-intl/server';
import {defineRouting} from 'next-intl/routing';
import {createNavigation} from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['zh', 'en'],
  defaultLocale: 'zh'
});

export const {Link, redirect, usePathname, useRouter} =
  createNavigation(routing);

export default getRequestConfig(async ({requestLocale}) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'zh' | 'en')) {
    locale = routing.defaultLocale;
  }

  return {
    locale: locale as string,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});