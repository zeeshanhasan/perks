import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Employee Perks: corporate discounts for Shopify</h1>
        <p className={styles.text}>
          Give partner company employees automatic discounts and employee-only products. Log in with your store
          domain to open the app.
        </p>
        {showForm && (
          <Form className={styles.form} method="post">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>{errors?.shop ?? "e.g: my-shop-domain.myshopify.com"}</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Automatic perks</strong>. Employees who log in with their work email get the discount instantly.
          </li>
          <li>
            <strong>Employee-only products</strong>. Only employees can check out, enforced by Shopify at checkout.
          </li>
          <li>
            <strong>Full control</strong>. Remove access anytime, with every change in the activity log.
          </li>
        </ul>
        <p className={styles.text}>
          <a href="/privacy">Privacy policy</a> · <a href="mailto:support@tofoapp.com">support@tofoapp.com</a>
        </p>
      </div>
    </div>
  );
}
