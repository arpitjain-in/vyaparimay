import { ProductSKU, PackagingMaterial, RawMaterialDef } from '../types';

export const PRODUCTS: ProductSKU[] = [
  // Wheat Flour
  { id: 'WF-26K',  product: 'Wheat Flour', productId: 'WF', variant: '26 kg Bag',        weight: 26,   packagingId: 'PKG-WF-26K',  hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  { id: 'WF-5P',   product: 'Wheat Flour', productId: 'WF', variant: '5 kg Pouch',        weight: 5,    packagingId: 'PKG-WF-5P',   hsnCode: '1101', gstRate: 5, unit: 'Pouch'  },
  { id: 'WF-10P',  product: 'Wheat Flour', productId: 'WF', variant: '10 kg Pouch',       weight: 10,   packagingId: 'PKG-WF-10P',  hsnCode: '1101', gstRate: 5, unit: 'Pouch'  },
  { id: 'WF-5H',   product: 'Wheat Flour', productId: 'WF', variant: '5 kg Handle Bag',   weight: 5,    packagingId: 'PKG-WF-5H',   hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  { id: 'WF-10H',  product: 'Wheat Flour', productId: 'WF', variant: '10 kg Handle Bag',  weight: 10,   packagingId: 'PKG-WF-10H',  hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  // Besan
  { id: 'BS-40K',  product: 'Besan',       productId: 'BS', variant: '40 kg Bag',         weight: 40,   packagingId: 'PKG-BS-40K',  hsnCode: '1106', gstRate: 5, unit: 'Bag'    },
  { id: 'BS-500G', product: 'Besan',       productId: 'BS', variant: '500 gm Packet',     weight: 0.5,  packagingId: 'PKG-BS-500G', hsnCode: '1106', gstRate: 5, unit: 'Packet' },
  // Daliya
  { id: 'DL-500G', product: 'Daliya', productId: 'DL', variant: '500 gm Packet', weight: 0.5, packagingId: 'PKG-DL-500G', hsnCode: '1104', gstRate: 5, unit: 'Packet' },
  // Bran
  { id: 'BR-50K',  product: 'Bran', productId: 'BR', variant: '50 kg Bag',  weight: 50,  packagingId: 'PKG-BR-50K',  hsnCode: '2302', gstRate: 5, unit: 'Bag' },
  { id: 'BR-25K',  product: 'Bran', productId: 'BR', variant: '25 kg Bag',  weight: 25,  packagingId: 'PKG-BR-25K',  hsnCode: '2302', gstRate: 5, unit: 'Bag' },
];

export const PACKAGING_MATERIALS: PackagingMaterial[] = [
  { id: 'PKG-WF-26K',  name: '26 kg Bags (Wheat Flour)',       usedFor: ['WF-26K']  },
  { id: 'PKG-WF-5P',   name: '5 kg Pouches (Wheat Flour)',     usedFor: ['WF-5P']   },
  { id: 'PKG-WF-10P',  name: '10 kg Pouches (Wheat Flour)',    usedFor: ['WF-10P']  },
  { id: 'PKG-WF-5H',   name: '5 kg Handle Bags (Wheat Flour)', usedFor: ['WF-5H']   },
  { id: 'PKG-WF-10H',  name: '10 kg Handle Bags (Wheat Flour)',usedFor: ['WF-10H']  },
  { id: 'PKG-BS-40K',  name: '40 kg Bags (Besan)',             usedFor: ['BS-40K']  },
  { id: 'PKG-BS-500G', name: '500 gm Packets (Besan)',         usedFor: ['BS-500G'] },
  { id: 'PKG-DL-500G', name: '500 gm Packets (Daliya)', usedFor: ['DL-500G'] },
  { id: 'PKG-BR-50K',  name: '50 kg Bags (Bran)',       usedFor: ['BR-50K']  },
  { id: 'PKG-BR-25K',  name: '25 kg Bags (Bran)',       usedFor: ['BR-25K']  },
];

export const RAW_MATERIALS: RawMaterialDef[] = [
  { id: 'RM-WF', name: 'Wheat Flour', products: ['WF-26K', 'WF-5P', 'WF-10P', 'WF-5H', 'WF-10H'] },
  { id: 'RM-BS', name: 'Besan',       products: ['BS-40K', 'BS-500G'] },
  { id: 'RM-DL', name: 'Daliya', products: ['DL-500G'] },
  { id: 'RM-BR', name: 'Bran',   products: ['BR-50K', 'BR-25K'] },
];

export const PRODUCT_CATEGORIES = ['Wheat Flour', 'Besan', 'Daliya', 'Bran'];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu & Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Default prices (₹ per unit, user-editable)
export const DEFAULT_PRICES: Record<string, number> = {
  'WF-26K':  780,
  'WF-5P':   165,
  'WF-10P':  320,
  'WF-5H':   175,
  'WF-10H':  340,
  'BS-40K':  2400,
  'BS-500G': 35,
  'DL-500G': 28,
  'BR-50K':  600,
  'BR-25K':  310,
};

export function getRawMaterialId(productId: string): string {
  if (productId === 'WF') return 'RM-WF';
  if (productId === 'BS') return 'RM-BS';
  if (productId === 'BR') return 'RM-BR';
  return 'RM-DL';
}
