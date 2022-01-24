import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { BackHandler } from 'react-native'
import { useCallback } from 'use-memo-one'

import {
  ModalStack as ModalStackType,
  ModalStateSubscription,
  ModalContextProvider,
  ModalEventListeners,
  ModalStateListener,
  SharedProps,
} from '../types'

import ModalContext from './ModalContext'
import ModalStack from './ModalStack'
import ModalState from './ModalState'

import { invariant, validateListener } from '../utils'

interface Props {
  children: ReactNode
  stack: ModalStackType<any>
}

/**
 * `<ModalProvider>` is the component you're going to use to wrap your whole application,
 * so it'll be able to display your modals on top of everything else, using React Context API.
 *
 * @prop { ModalStackType } `stack` - Modal stack object generated by `createModalStack()`
 *
 * @see https://colorfy-software.gitbook.io/react-native-modalfy/guides/stack#provider
 */
const ModalProvider = ({ children, stack }: Props) => {
  const modalStateSubscription =
    useRef<ModalStateSubscription<any> | undefined>()

  const modalEventListeners = useRef<ModalEventListeners>(new Set()).current

  const openModal: SharedProps<any>['openModal'] = (modalName, params) => {
    const { currentModal } = ModalState.getState()

    if (!currentModal) {
      BackHandler.addEventListener(
        'hardwareBackPress',
        ModalState.handleBackPress,
      )
    }

    ModalState.openModal(modalName, params)
  }

  const getParam: SharedProps<any>['getParam'] = (
    hash,
    paramName,
    defaultValue,
  ) => ModalState.getParam(hash, paramName, defaultValue)

  const closeModal: SharedProps<any>['closeModal'] = (stackItem) =>
    ModalState.closeModal(stackItem)

  const closeModals: SharedProps<any>['closeModals'] = (modalName) =>
    ModalState.closeModals(modalName)

  const closeAllModals: SharedProps<any>['closeAllModals'] = () =>
    ModalState.closeAllModals()

  const [contextValue, setContextValue] = useState<
    ModalContextProvider<any, any>
  >({
    currentModal: null,
    closeAllModals,
    closeModals,
    closeModal,
    openModal,
    getParam,
    stack,
  })

  const registerListener: SharedProps<any>['registerListener'] = useCallback(
    (hash, eventName, handler) => {
      validateListener('add', { eventName, handler })
      const newListener = {
        event: `${hash}_${eventName}`,
        handler,
      }

      modalEventListeners.add(newListener)

      return {
        remove: () => modalEventListeners.delete(newListener),
      }
    },
    [modalEventListeners],
  )

  const clearListeners: SharedProps<any>['clearListeners'] = useCallback(
    (hash) => {
      modalEventListeners.forEach((item) => {
        if (item.event.includes(hash)) modalEventListeners.delete(item)
      })
    },
    [modalEventListeners],
  )

  const listener: ModalStateListener<any> = (modalState, error) => {
    if (modalState) {
      setContextValue({
        ...contextValue,
        currentModal: modalState.currentModal,
        stack: modalState.stack,
      })
    } else console.warn('Modalfy', error)
  }

  useEffect(() => {
    invariant(stack, 'You need to provide a `stack` prop to <ModalProvider>')

    ModalState.init<any>(() => ({
      currentModal: null,
      stack,
    }))

    modalStateSubscription.current = ModalState.subscribe(listener)

    return () => {
      BackHandler.removeEventListener(
        'hardwareBackPress',
        ModalState.handleBackPress,
      )
      modalStateSubscription.current?.unsubscribe()
    }

    // NOTE: Should only be triggered on initial mount and return when unmounted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ModalContext.Provider value={contextValue}>
      <>
        {children}
        <ModalStack
          {...contextValue}
          clearListeners={clearListeners}
          registerListener={registerListener}
          eventListeners={modalEventListeners}
          removeClosingAction={ModalState.removeClosingAction}
        />
      </>
    </ModalContext.Provider>
  )
}

export default ModalProvider
