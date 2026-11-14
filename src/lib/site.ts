import config from "../../content/site.json";

export const SITE = {
  url: config.url,
  name: config.name.zh,
  nameEn: config.name.en,
  author: config.author.zh,
  authorEn: config.author.en,
  tagline: {
    zh: config.tagline.zh,
    en: config.tagline.en,
  },
  description: {
    zh: config.description.zh,
    en: config.description.en,
  },
  bio: {
    zh: config.bio.zh,
    en: config.bio.en,
  },
  now: {
    zh: config.now.zh,
    en: config.now.en,
  },
  github: config.github,
  x: config.x,
  walineUrl: config.walineUrl,
  license: config.license,
  licenseUrl: config.licenseUrl,
  startYear: config.startYear,
  email: null as string | null,
};
