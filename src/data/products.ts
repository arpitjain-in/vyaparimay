import { ProductSKU, PackagingMaterial, RawMaterialDef } from '../types';

export const PRODUCTS: ProductSKU[] = [
  // Shikharji Atta
  { id: 'WF-26K',  product: 'Shikharji Atta', productId: 'WF', variant: '26 kg Bag',        weight: 26,   packagingId: 'PKG-WF-26K',  hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  { id: 'WF-25K',  product: 'Shikharji Atta', productId: 'WF', variant: '25 kg Bag',        weight: 25,   packagingId: 'PKG-WF-26K',  hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  { id: 'WF-5P',   product: 'Shikharji Atta', productId: 'WF', variant: '5 kg Pouch',        weight: 5,    packagingId: 'PKG-WF-5P',   hsnCode: '1101', gstRate: 5, unit: 'Pouch'  },
  { id: 'WF-10P',  product: 'Shikharji Atta', productId: 'WF', variant: '10 kg Pouch',       weight: 10,   packagingId: 'PKG-WF-10P',  hsnCode: '1101', gstRate: 5, unit: 'Pouch'  },
  { id: 'WF-5H',   product: 'Shikharji Atta', productId: 'WF', variant: '5 kg Handle Bag',   weight: 5,    packagingId: 'PKG-WF-5H',   hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  { id: 'WF-10H',  product: 'Shikharji Atta', productId: 'WF', variant: '10 kg Handle Bag',  weight: 10,   packagingId: 'PKG-WF-10H',  hsnCode: '1101', gstRate: 5, unit: 'Bag'    },
  // Shikharji Besan
  { id: 'BS-40K',  product: 'Shikharji Besan',       productId: 'BS', variant: '40 kg Bag',         weight: 40,   packagingId: 'PKG-BS-40K',  hsnCode: '1106', gstRate: 5, unit: 'Bag'    },
  { id: 'BS-500G', product: 'Shikharji Besan',       productId: 'BS', variant: '500 gm Packet',     weight: 0.5,  packagingId: 'PKG-BS-500G', hsnCode: '1106', gstRate: 5, unit: 'Packet' },
  // Shikharji Dalia
  { id: 'DL-500G', product: 'Shikharji Dalia', productId: 'DL', variant: '500 gm Packet', weight: 0.5, packagingId: 'PKG-DL-500G', hsnCode: '1104', gstRate: 5, unit: 'Packet' },
  // Shikharji Bran
  { id: 'BR-40K',  product: 'Shikharji Bran', productId: 'BR', variant: '40 kg Bag',  weight: 40,  packagingId: 'PKG-BR-40K',  hsnCode: '2302', gstRate: 5, unit: 'Bag' },
];

export const PACKAGING_MATERIALS: PackagingMaterial[] = [
  { id: 'PKG-WF-26K',  name: '25/26 kg Bags (Shikharji Atta)',    usedFor: ['WF-26K', 'WF-25K']  },
  { id: 'PKG-WF-5P',   name: '5 kg Pouches (Shikharji Atta)',     usedFor: ['WF-5P']   },
  { id: 'PKG-WF-10P',  name: '10 kg Pouches (Shikharji Atta)',    usedFor: ['WF-10P']  },
  { id: 'PKG-WF-5H',   name: '5 kg Handle Bags (Shikharji Atta)', usedFor: ['WF-5H']   },
  { id: 'PKG-WF-10H',  name: '10 kg Handle Bags (Shikharji Atta)',usedFor: ['WF-10H']  },
  { id: 'PKG-BS-40K',  name: '40 kg Bags (Shikharji Besan)',             usedFor: ['BS-40K']  },
  { id: 'PKG-BS-500G', name: '500 gm Packets (Shikharji Besan)',         usedFor: ['BS-500G'] },
  { id: 'PKG-DL-500G', name: '500 gm Packets (Shikharji Dalia)', usedFor: ['DL-500G'] },
  { id: 'PKG-BR-40K',    name: '40 kg Bags (Shikharji Bran)',       usedFor: ['BR-40K']  },
  { id: 'PKG-OUTER-10X3', name: 'Outer Bag 10X3',                   usedFor: []          },
  { id: 'PKG-OUTER-5X6',  name: 'Outer Bag 5X6',                    usedFor: []          },
];

export const RAW_MATERIALS: RawMaterialDef[] = [
  { id: 'RM-WF', name: 'Shikharji Atta', products: ['WF-26K', 'WF-25K', 'WF-5P', 'WF-10P', 'WF-5H', 'WF-10H'] },
  { id: 'RM-BS', name: 'Shikharji Besan',       products: ['BS-40K', 'BS-500G'] },
  { id: 'RM-DL', name: 'Shikharji Dalia', products: ['DL-500G'] },
  { id: 'RM-BR', name: 'Shikharji Bran',   products: ['BR-40K'] },
];

export const PRODUCT_CATEGORIES = ['Shikharji Atta', 'Shikharji Besan', 'Shikharji Dalia', 'Shikharji Bran'];

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
  'WF-25K':  750,
  'WF-5P':   165,
  'WF-10P':  320,
  'WF-5H':   175,
  'WF-10H':  340,
  'BS-40K':  2400,
  'BS-500G': 35,
  'DL-500G': 28,
  'BR-40K':  480,
};

export function getRawMaterialId(productId: string): string {
  if (productId === 'WF') return 'RM-WF';
  if (productId === 'BS') return 'RM-BS';
  if (productId === 'BR') return 'RM-BR';
  return 'RM-DL';
}
