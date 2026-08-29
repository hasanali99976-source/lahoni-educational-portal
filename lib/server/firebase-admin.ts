import "server-only";

import { addDoc, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, limit, query, runTransaction as firestoreRunTransaction, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

class DocumentSnapshotCompat {
  constructor(private snapshot: any) {}
  get id() { return this.snapshot.id; }
  get exists() { return this.snapshot.exists(); }
  get ref() { return { path: this.snapshot.ref.path }; }
  data(): any { return this.snapshot.data(); }
}

class DocumentReferenceCompat {
  constructor(readonly path: string, readonly id: string) {}
  async get() { return new DocumentSnapshotCompat(await getDoc(doc(db, this.path, this.id))); }
  async set(value: Record<string, unknown>, options?: { merge?: boolean }) { if (options) await setDoc(doc(db, this.path, this.id), value, options); else await setDoc(doc(db, this.path, this.id), value); }
  async update(value: Record<string, unknown>) { await updateDoc(doc(db, this.path, this.id), value); }
  async delete() { await deleteDoc(doc(db, this.path, this.id)); }
}

class CollectionReferenceCompat {
  private filters: Array<[string, string, unknown]> = [];
  private max?: number;
  constructor(readonly path: string) {}
  where(field: string, operator: string, value: unknown) { this.filters.push([field, operator, value]); return this; }
  limit(value: number) { this.max = value; return this; }
  doc(id = crypto.randomUUID()) { return new DocumentReferenceCompat(this.path, id); }
  async add(value: Record<string, unknown>) { const reference = await addDoc(collection(db, this.path), value); return new DocumentReferenceCompat(this.path, reference.id); }
  async get() {
    const constraints = this.filters.map(([field, operator, value]) => where(field, operator as never, value));
    if (this.max) constraints.push(limit(this.max) as never);
    const snapshot = await getDocs(query(collection(db, this.path), ...constraints));
    return { empty: snapshot.empty, docs: snapshot.docs.map(item => new DocumentSnapshotCompat(item as never)) };
  }
}

class CollectionGroupReferenceCompat {
  private filters: Array<[string, string, unknown]> = [];
  private max?: number;
  constructor(readonly id: string) {}
  where(field: string, operator: string, value: unknown) { this.filters.push([field, operator, value]); return this; }
  limit(value: number) { this.max = value; return this; }
  async get() {
    const constraints = this.filters.map(([field, operator, value]) => where(field, operator as never, value));
    if (this.max) constraints.push(limit(this.max) as never);
    const snapshot = await getDocs(query(collectionGroup(db, this.id), ...constraints));
    return { empty: snapshot.empty, docs: snapshot.docs.map(item => new DocumentSnapshotCompat(item as never)) };
  }
}

class BatchCompat {
  private batch = writeBatch(db);
  set(reference: DocumentReferenceCompat, value: Record<string, unknown>, options?: { merge?: boolean }) { if (options) this.batch.set(doc(db, reference.path, reference.id), value, options); else this.batch.set(doc(db, reference.path, reference.id), value); return this; }
  delete(reference: DocumentReferenceCompat) { this.batch.delete(doc(db, reference.path, reference.id)); return this; }
  async commit() { await this.batch.commit(); }
}

class TransactionCompat {
  constructor(private transaction: any) {}
  async get(reference: DocumentReferenceCompat) {
    const snapshot = await this.transaction.get(doc(db, reference.path, reference.id));
    return new DocumentSnapshotCompat(snapshot);
  }
  set(reference: DocumentReferenceCompat, value: Record<string, unknown>, options?: { merge?: boolean }) {
    if (options) this.transaction.set(doc(db, reference.path, reference.id), value, options);
    else this.transaction.set(doc(db, reference.path, reference.id), value);
    return this;
  }
  delete(reference: DocumentReferenceCompat) {
    this.transaction.delete(doc(db, reference.path, reference.id));
    return this;
  }
}

class FirestoreCompat {
  collection(path: string) { return new CollectionReferenceCompat(path); }
  collectionGroup(id: string) { return new CollectionGroupReferenceCompat(id); }
  batch() { return new BatchCompat(); }
  runTransaction<T>(callback: (transaction: TransactionCompat) => Promise<T>) {
    return firestoreRunTransaction(db, transaction => callback(new TransactionCompat(transaction)));
  }
}

const firestore = new FirestoreCompat();
export function adminDb() { return firestore; }
