import { randomUUID } from 'node:crypto';
// Faker 10 is ESM; Node 24 supports require(ESM), while this framework uses CommonJS.
const { faker } = require('@faker-js/faker') as typeof import('@faker-js/faker', {
  with: { 'resolution-mode': 'import' },
});

export class RandomDataUtil {
  /** Generates valid registration data with a unique email for every execution. */
  static generateCustomerPayload() {
    return {
      firstName: this.getFirstName().slice(0, 32),
      lastName: this.getLastName().slice(0, 32),
      email: `pw-${randomUUID()}@${this.getEmail().split('@')[1]}`,
      telephone: this.getPhoneNumber().slice(0, 32),
      password: this.getPassword(),
    };
  }

  static getFirstName(): string { return faker.person.firstName(); }
  static getLastName(): string { return faker.person.lastName(); }
  static getFullName(): string { return faker.person.fullName(); }
  static getEmail(): string { return faker.internet.email(); }
  static getPhoneNumber(): string { return faker.phone.number(); }
  static getUsername(): string { return faker.internet.username(); }
  static getPassword(length: number = 10): string { return faker.internet.password({ length }); }
  static getCountry(): string { return faker.location.country(); }
  static getState(): string { return faker.location.state(); }
  static getCity(): string { return faker.location.city(); }
  static getStreet(): string { return faker.location.street(); }
  static getStreetAddress(): string { return faker.location.streetAddress(); }
  static getZipCode(): string { return faker.location.zipCode(); }
  static getLatitude(): string { return String(faker.location.latitude()); }
  static getLongitude(): string { return String(faker.location.longitude()); }

  static getCurrentDate(): string { return new Date().toISOString().split('T')[0]; }
  static getRecentDate(days: number = 10): string { return faker.date.recent({ days }).toISOString().split('T')[0]; }
  static getFutureDate(years: number = 1): string { return faker.date.future({ years }).toISOString().split('T')[0]; }
  static getPastDate(years: number = 1): string { return faker.date.past({ years }).toISOString().split('T')[0]; }

  static getProductName(): string { return faker.commerce.productName(); }
  static getProductDescription(): string { return faker.commerce.productDescription(); }
  static getProductPrice(): string { return faker.commerce.price({ min: 1, max: 500, dec: 2 }); }
  static getDepartment(): string { return faker.commerce.department(); }
  static getImageUrl(): string { return faker.image.url(); }
  static getNumber(): number { return faker.number.int({ min: 1, max: 999 }); }

  static generateInvalidLoginPayload() {
    return { username: this.getUsername(), password: this.getPassword() };
  }

  static generateProductPayload() {
    return {
      title: this.getProductName(),
      price: Number(this.getProductPrice()),
      description: this.getProductDescription(),
      image: this.getImageUrl(),
      category: this.getDepartment().toLowerCase(),
    };
  }

  static generateUpdatedProductPayload() {
    const product = this.generateProductPayload();
    return { ...product, title: `Updated ${product.title}` };
  }

  static generateUserPayload() {
    return {
      email: this.getEmail(),
      username: this.getUsername(),
      password: this.getPassword(),
      name: { firstname: this.getFirstName(), lastname: this.getLastName() },
      address: {
        city: this.getCity(),
        street: this.getStreet(),
        number: this.getNumber(),
        zipcode: this.getZipCode(),
        geolocation: { lat: this.getLatitude(), long: this.getLongitude() },
      },
      phone: this.getPhoneNumber(),
    };
  }

  static generateUserUpdatePayload() {
    const user = this.generateUserPayload();
    return { ...user, username: `updated-${user.username}` };
  }

  static generateCartPayload(userId: number) {
    return {
      userId,
      date: this.getCurrentDate(),
      products: [{ productId: this.getNumber(), quantity: this.getNumber() }],
    };
  }

  static generateUpdatedCartPayload(userId: number) {
    return this.generateCartPayload(userId);
  }
}
