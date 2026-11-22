import { expect, type Locator, type Page } from '@playwright/test';
import type { E2eUser } from '../support/env';

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel(/^Email/);
    this.password = page.getByLabel(/^Contraseña/);
    this.submit = page.getByRole('button', { name: 'Ingresar' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.submit).toBeVisible();
  }

  async signIn(user: E2eUser): Promise<void> {
    await this.email.fill(user.email);
    await this.password.fill(user.password);
    await this.submit.click();
  }
}
