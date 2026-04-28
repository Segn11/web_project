export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  rating: {
    rate: number;
    count: number;
  };
}

export interface CartItem extends Product {
  quantity: number;
  cartItemId?: number;
}

export interface User {
  id: string;
  username?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: 'admin' | 'user';
  password?: string;
  first_name?: string;
  last_name?: string;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  items: CartItem[];
  status: 'Processing' | 'Shipped' | 'Delivered';
}
