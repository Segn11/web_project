'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useRouter } from 'next/navigation';
import { Order, Product, User } from '@/types';
import { Package, Settings, LogOut, Heart, Shield, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductCard } from '@/components/ProductCard';
import Link from 'next/link';
import { getProducts, deleteProduct, addProduct, getOrders } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, logout, updateProfile, getAllUsers, deleteUser, isLoading } = useAuth();
  const { wishlistItems } = useWishlist();
  const router = useRouter();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'settings' | 'admin'>('orders');

  // Admin state
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newProduct, setNewProduct] = useState({ title: '', price: '', description: '', category: '', image: '' });

  const loadAdminData = useCallback(async () => {
    try {
      const prods = await getProducts();
      setProducts(prods);
      setUsers(getAllUsers());
    } catch (error) {
      console.error('Failed to load admin data', error);
      toast.error('Failed to load admin dashboard data');
    }
  }, [getAllUsers]);

  const loadOrders = useCallback(async () => {
    try {
      const orderResponse = await getOrders();
      const backendOrders = Array.isArray(orderResponse) ? orderResponse : orderResponse.results || [];
      setOrders(backendOrders.map((order: any) => ({
        id: String(order.id),
        date: order.created_at,
        total: Number(order.total),
        items: (order.items || []).map((item: any) => ({
          id: item.product?.id || item.product,
          title: item.product_name,
          price: Number(item.unit_price),
          description: '',
          category: '',
          image: item.product?.images?.[0]?.image_url || item.product?.images?.find?.((image: any) => image.is_primary)?.image_url || '',
          quantity: item.quantity,
          rating: { rate: 0, count: 0 },
        })),
        status: order.status,
      })));
    } catch (error) {
      console.error('Failed to load orders', error);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    } else if (user) {
      if (user.role === 'admin') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadAdminData();
      }
      void loadOrders();
    }
  }, [user, isLoading, router, loadAdminData, loadOrders]);

  const handleUpdateProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    updateProfile(name, email);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const added = await addProduct({
        title: newProduct.title,
        price: parseFloat(newProduct.price),
        description: newProduct.description,
        category: newProduct.category,
        image: newProduct.image || 'https://picsum.photos/seed/product/400/400',
        rating: { rate: 0, count: 0 }
      });
      setProducts([...products, added]);
      setNewProduct({ title: '', price: '', description: '', category: '', image: '' });
      toast.success('Product added');
    } catch (error) {
      toast.error('Failed to add product');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    await deleteProduct(id);
    setProducts(products.filter(p => p.id !== id));
    toast.success('Product deleted');
  };

  const handleDeleteUser = (id: string) => {
    if (id === user?.id) {
      toast.error('Cannot delete yourself');
      return;
    }
    deleteUser(id);
    setUsers(users.filter(u => u.id !== id));
  };

  if (isLoading || !user) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 md:px-6 lg:py-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl border bg-white p-6 text-center">
            <img
              src={user.avatar}
              alt={user.name}
              className="mx-auto h-24 w-24 rounded-full bg-zinc-100"
            />
            <h2 className="mt-4 text-xl font-bold">{user.name}</h2>
            <p className="text-sm text-zinc-500">{user.email}</p>
            
            <div className="mt-8 flex flex-col gap-2">
              <Button 
                variant={activeTab === 'orders' ? 'secondary' : 'ghost'} 
                className="justify-start gap-3 rounded-xl"
                onClick={() => setActiveTab('orders')}
              >
                <Package className="h-4 w-4" />
                Orders
              </Button>
              <Button 
                variant={activeTab === 'wishlist' ? 'secondary' : 'ghost'} 
                className="justify-start gap-3 rounded-xl"
                onClick={() => setActiveTab('wishlist')}
              >
                <Heart className="h-4 w-4" />
                Wishlist
              </Button>
              <Button 
                variant={activeTab === 'settings' ? 'secondary' : 'ghost'} 
                className="justify-start gap-3 rounded-xl"
                onClick={() => setActiveTab('settings')}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
              {user.role === 'admin' && (
                <Button 
                  variant={activeTab === 'admin' ? 'secondary' : 'ghost'} 
                  className="justify-start gap-3 rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setActiveTab('admin')}
                >
                  <Shield className="h-4 w-4" />
                  Admin Dashboard
                </Button>
              )}
              <Button 
                variant="ghost" 
                className="justify-start gap-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9">
          {activeTab === 'orders' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
              <div className="mt-8 space-y-6">
                {orders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-12 text-center">
                    <Package className="mx-auto h-12 w-12 text-zinc-300" />
                    <h3 className="mt-4 text-lg font-medium">No orders yet</h3>
                    <p className="mt-2 text-zinc-500">When you place an order, it will appear here.</p>
                    <Link href="/products">
                      <Button className="mt-6 rounded-full">Start Shopping</Button>
                    </Link>
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="rounded-2xl border bg-white p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
                        <div>
                          <p className="text-sm text-zinc-500">Order <span className="font-medium text-zinc-900">{order.id}</span></p>
                          <p className="text-sm text-zinc-500">Placed on {new Date(order.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            {order.status}
                          </span>
                          <p className="font-bold">${order.total.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex shrink-0 items-center gap-4 rounded-xl border p-2 pr-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-50 p-2">
                              <img src={item.image} alt={item.title} className="max-h-full max-w-full object-contain" />
                            </div>
                            <div>
                              <p className="max-w-[150px] truncate text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'wishlist' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Your Wishlist</h1>
              <div className="mt-8">
                {wishlistItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed p-12 text-center">
                    <Heart className="mx-auto h-12 w-12 text-zinc-300" />
                    <h3 className="mt-4 text-lg font-medium">Your wishlist is empty</h3>
                    <p className="mt-2 text-zinc-500">Save items you love to your wishlist.</p>
                    <Link href="/products">
                      <Button className="mt-6 rounded-full">Explore Products</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {wishlistItems.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
              <div className="mt-8 max-w-2xl rounded-3xl border bg-white p-8">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input 
                        name="name"
                        defaultValue={user.name}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input 
                        name="email"
                        type="email"
                        defaultValue={user.email}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="rounded-full">
                    Save Changes
                  </Button>
                </form>
              </div>
            </>
          )}
          {activeTab === 'admin' && user.role === 'admin' && (
            <>
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              
              <div className="mt-8 space-y-12">
                {/* Users Management */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Manage Users</h2>
                  <div className="rounded-2xl border bg-white overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 border-b">
                        <tr>
                          <th className="px-6 py-4 font-medium text-zinc-500">Name</th>
                          <th className="px-6 py-4 font-medium text-zinc-500">Email</th>
                          <th className="px-6 py-4 font-medium text-zinc-500">Role</th>
                          <th className="px-6 py-4 font-medium text-zinc-500 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-zinc-50">
                            <td className="px-6 py-4 font-medium">{u.name}</td>
                            <td className="px-6 py-4 text-zinc-500">{u.email}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-700'}`}>
                                {u.role || 'user'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.id === user.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Products Management */}
                <div>
                  <h2 className="text-xl font-bold mb-4">Manage Products</h2>
                  
                  {/* Add Product Form */}
                  <div className="rounded-2xl border bg-white p-6 mb-6">
                    <h3 className="text-lg font-medium mb-4">Add New Product</h3>
                    <form onSubmit={handleAddProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Title</label>
                        <Input required value={newProduct.title} onChange={e => setNewProduct({...newProduct, title: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Price</label>
                        <Input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Input required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Image URL (optional)</label>
                        <Input value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} placeholder="https://..." />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-sm font-medium">Description</label>
                        <Input required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                      </div>
                      <div className="sm:col-span-2">
                        <Button type="submit" className="w-full sm:w-auto">
                          <Plus className="mr-2 h-4 w-4" /> Add Product
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Products List */}
                  <div className="rounded-2xl border bg-white overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-zinc-50 border-b">
                        <tr>
                          <th className="px-6 py-4 font-medium text-zinc-500">Product</th>
                          <th className="px-6 py-4 font-medium text-zinc-500">Price</th>
                          <th className="px-6 py-4 font-medium text-zinc-500">Category</th>
                          <th className="px-6 py-4 font-medium text-zinc-500 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-zinc-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100 p-1">
                                  <img src={p.image} alt={p.title} className="h-full w-full object-contain" />
                                </div>
                                <span className="font-medium line-clamp-1 max-w-[200px]">{p.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">${p.price.toFixed(2)}</td>
                            <td className="px-6 py-4 capitalize">{p.category}</td>
                            <td className="px-6 py-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteProduct(p.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
