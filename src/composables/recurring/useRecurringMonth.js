import { db, auth } from "../../firebase.config.js"
import { collection, addDoc, getDocs, query, where, orderBy, doc, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore"
import { calculateElapsedMonths } from "../../utils/functions.js"
import { convertCurrency } from "../../utils/functions.js"


export const useRecurringMonth = async (schedule) => {
  const collectionRef = collection(db, schedule.type)
  const scheduleRef = doc(db, "schedules", schedule.id)
  const lastRepeatedDateMs = schedule.lastRepeatedDate.toMillis()
  console.log("Last repeated:", lastRepeatedDateMs)
  const endDateMs = schedule.endDate?.toMillis()
  const currentDateMs = Date.now()
  const checkDateMs = schedule.endDate ? Math.min(endDateMs, currentDateMs) : currentDateMs
  console.log("Check until:", checkDateMs)

  // TODO: Logic for creating first item (e.g., monthly schedule created on 13th to repeat on the 15th)
  // A month hasn't passed yet but need that first item
  // If list of repeated Item IDs is empty, then no first item yet
  // How to tell if first item is needed?
  // Today's day of month equals chosen day of month

  console.log("Item IDs:", schedule.itemIds.length, "Date:", new Date().getDate() === schedule.dayOfMonth)
  if (schedule.itemIds.length === 0 && new Date().getDate() === schedule.dayOfMonth) {
    console.log("Creating first item...")
    const firstItemDate = new Date(new Date().setHours(0, 0, 0))
    schedule.prototype.date = firstItemDate

    schedule.prototype.amount = schedule.prototype.conversion
    ? await convertCurrency(schedule.prototype.baseAmount, schedule.prototype.baseCurrency, schedule.prototype.currency, firstItemDate)
    : schedule.prototype.amount

    const docRef = await addDoc(collectionRef, schedule.prototype)
    console.log("Recurring item created in collection", schedule.type, "with ID:", docRef.id)
    await updateDoc(docRef, { scheduleName: schedule.name})

    await updateDoc(scheduleRef, { itemIds: arrayUnion(docRef.id) })
    await updateDoc(scheduleRef, { lastRepeatedDate: firstItemDate })
  }

  const itemsToCreate = Math.max(calculateElapsedMonths(lastRepeatedDateMs, checkDateMs), 0)
  console.log("Items:", itemsToCreate)

  let lastRepeatedDateValue = new Date(lastRepeatedDateMs)
  const monthIndex = lastRepeatedDateValue.getMonth()

  for (let i = 1; i <= itemsToCreate; i++) {
    lastRepeatedDateValue.setMonth(monthIndex + i)
    let itemDate = new Date(lastRepeatedDateValue)
    itemDate.setDate(schedule.dayOfMonth)
    console.log("Item date:", itemDate)
    schedule.prototype.date = itemDate

    schedule.prototype.amount = schedule.prototype.conversion
    ? await convertCurrency(schedule.prototype.baseAmount, schedule.prototype.baseCurrency, schedule.prototype.currency, itemDate)
    : schedule.prototype.amount

    const docRef = await addDoc(collectionRef, schedule.prototype)
    console.log("Recurring item created in collection", schedule.type, "with ID:", docRef.id)
    await updateDoc(docRef, { scheduleName: schedule.name})

    await updateDoc(scheduleRef, { itemIds: arrayUnion(docRef.id) })
    await updateDoc(scheduleRef, { lastRepeatedDate: itemDate })
  }

  if (currentDateMs > endDateMs) {
    await updateDoc(scheduleRef, { active: false })
  }

  return itemsToCreate > 0
}