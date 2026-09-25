import { Brand } from '../shared/models/catalog.model';

/** Brand portfolio published by Vinto. Logos are stored locally for speed. */
export const BRANDS: readonly Brand[] = [
  {
    id: 'caterware', slug: 'caterware', name: 'Caterware', logo: '/img/brands/caterware.png',
    description: {
      en: 'Professional food-service equipment and tableware selected for restaurants, hotels and caterers.',
      fr: 'Équipements et arts de la table professionnels sélectionnés pour les restaurants, hôtels et traiteurs.',
    },
    categoryIds: ['packaging'], website: 'https://vinto.tn/brand/18-caterware',
  },
  {
    id: 'dijona', slug: 'dijona', name: 'Dijona', logo: '/img/brands/dijona.png',
    description: {
      en: 'Mustards and condiments developed for consistent professional service.',
      fr: 'Moutardes et condiments conçus pour une utilisation professionnelle régulière.',
    },
    categoryIds: ['food'], website: 'https://vinto.tn/brand/10-dijona',
  },
  {
    id: 'emporium', slug: 'emporium', name: 'Emporium', logo: '/img/brands/emporium.png',
    description: {
      en: 'Pantry essentials and preserved ingredients for professional kitchens.',
      fr: 'Produits d’épicerie et ingrédients conservés destinés aux cuisines professionnelles.',
    },
    categoryIds: ['food'], website: 'https://vinto.tn/brand/8-emporium',
  },
  {
    id: 'martellato', slug: 'martellato', name: 'Martellato', logo: '/img/brands/martellato.png',
    description: {
      en: 'Italian pastry, presentation and single-portion solutions for professional catering.',
      fr: 'Solutions italiennes de pâtisserie, de présentation et de portions individuelles pour les professionnels.',
    },
    categoryIds: ['packaging'], country: { en: 'Italy', fr: 'Italie' },
    website: 'https://vinto.tn/brand/13-martellato',
  },
  {
    id: 'mayor', slug: 'mayor', name: 'Mayor', logo: '/img/brands/mayor.png',
    description: {
      en: 'Sauces and condiments for food service, quick-service restaurants and retail.',
      fr: 'Sauces et condiments pour la restauration, le snacking et la distribution.',
    },
    categoryIds: ['food'], website: 'https://vinto.tn/brand/17-mayor',
  },
  {
    id: 'monin', slug: 'monin', name: 'Monin', logo: '/img/brands/monin.png',
    description: {
      en: 'French beverage syrups, fruit mixes, sauces and frappé bases for bars, coffee shops and hospitality.',
      fr: 'Sirops français, purées de fruits, sauces et bases frappé pour les bars, coffee-shops et l’hôtellerie.',
    },
    categoryIds: ['monin'], country: { en: 'France', fr: 'France' },
    website: 'https://vinto.tn/brand/15-monin',
  },
  {
    id: 'varvello', slug: 'varvello', name: 'Varvello', logo: '/img/brands/varvello.png',
    description: {
      en: 'Italian vinegars, balsamic specialities and condiments for professional kitchens.',
      fr: 'Vinaigres italiens, spécialités balsamiques et condiments pour les cuisines professionnelles.',
    },
    categoryIds: ['food'], country: { en: 'Italy', fr: 'Italie' },
    website: 'https://vinto.tn/brand/12-varvello',
  },
];
