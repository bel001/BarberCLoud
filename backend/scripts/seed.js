import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { documentClient } from '../src/lib/db.js';
import { config } from '../src/lib/config.js';
import { hashPassword } from '../src/lib/auth.js';

const today = new Date();
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const afterTomorrow = new Date(today.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
const createdAt = new Date().toISOString();
const demoPassword = hashPassword('BarberCloud2026!');

const users = [
  { id: 'client-demo', name: 'Carlos Cliente', email: 'cliente@barbercloud.com', phone: '987654321', role: 'CLIENTE' },
  { id: 'barber-demo', name: 'Diego Barbero', email: 'barbero@barbercloud.com', phone: '986111222', role: 'BARBERO', specialties: ['Corte clásico', 'Barba'] },
  { id: 'secretary-demo', name: 'Ana Secretaria', email: 'secretaria@barbercloud.com', phone: '985333444', role: 'SECRETARIA' },
  { id: 'admin-demo', name: 'Lucía Administradora', email: 'admin@barbercloud.com', phone: '984555666', role: 'ADMIN' },
  { id: 'client-2', name: 'Martín Paredes', email: 'martin@example.com', phone: '981234567', role: 'CLIENTE' },
  { id: 'barber-2', name: 'Renzo Maestro', email: 'renzo@barbercloud.com', phone: '982222333', role: 'BARBERO', specialties: ['Fade', 'Diseños'] }
].map((user) => ({
  PK: `USER#${user.id}`,
  SK: 'META',
  GSI1PK: `ROLE#${user.role}`,
  GSI1SK: user.name.toLowerCase(),
  entityType: 'USER',
  ...user,
  passwordHash: demoPassword,
  active: true,
  createdAt
}));

const services = [
  { id: 'service-cut', name: 'Corte clásico', description: 'Corte personalizado con acabado profesional.', duration: 30, price: 30 },
  { id: 'service-fade', name: 'Fade premium', description: 'Degradado de precisión y perfilado.', duration: 45, price: 45 },
  { id: 'service-beard', name: 'Perfilado de barba', description: 'Diseño, perfilado y acabado de barba.', duration: 30, price: 25 },
  { id: 'service-combo', name: 'Corte + barba', description: 'Servicio completo para una imagen renovada.', duration: 60, price: 60 }
].map((service) => ({
  PK: `SERVICE#${service.id}`,
  SK: 'META',
  GSI1PK: 'SERVICES',
  GSI1SK: service.name.toLowerCase(),
  entityType: 'SERVICE',
  ...service,
  active: true,
  createdAt
}));

const inventory = [
  { id: 'inventory-shampoo', name: 'Shampoo profesional', stock: 12, unit: 'botellas', minimum: 5, cost: 24 },
  { id: 'inventory-gel', name: 'Gel fijador', stock: 7, unit: 'unidades', minimum: 4, cost: 18 },
  { id: 'inventory-blades', name: 'Cuchillas', stock: 40, unit: 'unidades', minimum: 15, cost: 2.5 },
  { id: 'inventory-towels', name: 'Toallas desechables', stock: 18, unit: 'unidades', minimum: 20, cost: 1.5 }
].map((item) => ({
  PK: `INVENTORY#${item.id}`,
  SK: 'META',
  GSI1PK: 'INVENTORY',
  GSI1SK: item.name.toLowerCase(),
  entityType: 'INVENTORY',
  ...item,
  active: true,
  createdAt
}));

const appointments = [
  {
    id: 'appointment-demo-1', clientId: 'client-demo', serviceId: 'service-cut', barberId: 'barber-demo',
    date: tomorrow, time: '10:00', duration: 30, price: 30, status: 'CONFIRMADA', source: 'ONLINE', notes: ''
  },
  {
    id: 'appointment-demo-2', clientId: 'client-2', serviceId: 'service-combo', barberId: 'barber-2',
    date: tomorrow, time: '11:00', duration: 60, price: 60, status: 'PENDIENTE', source: 'PRESENCIAL', notes: 'Cliente prefiere corte bajo.'
  },
  {
    id: 'appointment-demo-3', clientId: 'client-demo', serviceId: 'service-beard', barberId: 'barber-2',
    date: afterTomorrow, time: '15:00', duration: 30, price: 25, status: 'PENDIENTE', source: 'ONLINE', notes: ''
  }
].map((item) => ({
  PK: `APPOINTMENT#${item.id}`,
  SK: 'META',
  GSI1PK: `DATE#${item.date}`,
  GSI1SK: `${item.time}#${item.barberId}`,
  entityType: 'APPOINTMENT',
  ...item,
  createdAt
}));

const business = {
  PK: 'BUSINESS#CONFIG',
  SK: 'META',
  GSI1PK: 'BUSINESS',
  GSI1SK: 'CONFIG',
  entityType: 'BUSINESS',
  id: 'CONFIG',
  name: 'BarberCloud Studio',
  phone: '+51 987 000 111',
  address: 'Av. Principal 123, Perú',
  openTime: '09:00',
  closeTime: '19:00',
  slotMinutes: 30,
  cancellationHours: 2,
  currency: 'PEN',
  createdAt
};

const isLocal = Boolean(config.dynamodbEndpoint);
const items = isLocal
  ? [...users, ...services, ...inventory, ...appointments, business]
  : [...services, ...inventory, business];
for (let index = 0; index < items.length; index += 25) {
  const chunk = items.slice(index, index + 25);
  await documentClient.send(new BatchWriteCommand({
    RequestItems: {
      [config.tableName]: chunk.map((Item) => ({ PutRequest: { Item } }))
    }
  }));
}
console.log(`${isLocal ? 'Datos demo' : 'Datos base'} cargados: ${items.length} registros.`);
