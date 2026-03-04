'use client'

// Types
import type { Game, GameCard, SelectedCard } from '@/types/game.type'

// React
import { use, useEffect, useRef, useState } from 'react'

// Next
import { useRouter } from 'next/navigation'

// Redux
import { useAppSelector } from '@/redux/store'

// Fetch
import { GET, PUT } from '@/lib/fetch'

// Components
import Card, { CardContainer } from '@/components/Game/Card/Card'
import Sidebar from '@/components/Game/Sidebar'

// Icons
import { IconCards, IconCrown, IconMenu } from '@tabler/icons-react'

// Packages
import ConfettiExplosion from 'react-confetti-explosion'
import useToggle from '@/hooks/useToggle'
import classNames from 'classnames'

// Socket
import { useSocket } from '@/providers/SocketProvider'

// Toast
import { useToast } from '@/providers/ToastProvider'

export default function Game({
	params,
}: {
	params: Promise<{
		id: string
	}>
}) {
	const { id } = use(params)
	const router = useRouter()
	const { socket, currentGameId, onReconnect } = useSocket()
	const { showToast } = useToast()

	const auth = useAppSelector(({ auth }) => auth)

	const [game, setGame] = useState<Game>()

	const [hand, setHand] = useState<Array<GameCard>>([])
	const [blackHand, setBlackHand] = useState<Array<GameCard>>([])
	const handLengthRef = useRef(0)
	const wasCzarRef = useRef(false)

	const [showRoundWin, setShowRoundWin] = useState(false)

	const [round, setRound] = useState<Game['rounds'][0]>()

	const [menuVisible, toggleMenu] = useToggle(false)

	const leaveGame = async () => {
		try {
			await PUT(`/games/${id}/leave`, {
				player_id: auth.id,
			})
			router.push('/')
		} catch {
			showToast('Failed to leave game')
		}
	}

	const startGame = async () => {
		try {
			await PUT(`/games/${id}/start`, {
				player_id: auth.id,
			})
		} catch {
			showToast('Failed to start game')
		}
	}

	const handleSelectBlackCard = async (card: GameCard) => {
		try {
			await PUT(`/games/${id}/select-black-card`, {
				player_id: auth.id,
				card_id: card.id,
			})
		} catch {
			showToast('Failed to select black card')
		}
	}

	const handleSelectWhiteCard = async (card: GameCard) => {
		if (!round?.black_card) {
			return
		}

		if (
			round?.white_cards?.find((c: SelectedCard) => c.player_id === auth.id)
		) {
			return
		}

		try {
			await PUT(`/games/${id}/select-white-card`, {
				player_id: auth.id,
				card_id: card.id,
			})
			setHand((prev) => prev.filter((c) => c.id !== card.id))
		} catch {
			showToast('Failed to select white card')
		}
	}

	const handleSelectWinningCard = async (card: GameCard) => {
		try {
			await PUT(`/games/${id}/select-winning-card`, {
				card_id: card.id,
			})
		} catch {
			showToast('Failed to select winning card')
		}
	}

	const fetchGame = async () => {
		try {
			const data = await GET(`/games/${id}`)
			setGame(data)
			if (data?.rounds?.length > 0) {
				setRound(data.rounds[data.rounds.length - 1])
			}
		} catch {
			showToast('Failed to load game')
		}
	}

	useEffect(() => {
		fetchGame()
	}, [])

	// Socket event subscription — only manages listeners, no side effects on cleanup
	useEffect(() => {
		if (!socket) return

		socket.emit('join_game', id)
		if (currentGameId) {
			currentGameId.current = id
		}

		if (onReconnect) {
			onReconnect.current = fetchGame
		}

		const onGameUpdated = (data: Game) => {
			if (data.id === id) {
				setGame(data)
				if (data.rounds?.length > 0) {
					setRound(data.rounds[data.rounds.length - 1])
				}
			}
		}

		socket.on('game_updated', onGameUpdated)

		return () => {
			socket.off('game_updated', onGameUpdated)
			if (onReconnect) {
				onReconnect.current = null
			}
		}
	}, [socket, id])

	// Game leave on unmount — only fires once when component truly unmounts
	useEffect(() => {
		return () => {
			if (currentGameId) {
				currentGameId.current = null
			}
			socket?.emit('leave_game', id)
			PUT(`/games/${id}/leave`, { player_id: auth.id }).catch(() => {})
		}
	}, [])

	// Fallback for tab/browser close — uses fetch with keepalive to send JWT
	useEffect(() => {
		const handleBeforeUnload = () => {
			const apiBase = process.env.NEXT_PUBLIC_API || ''
			fetch(`${apiBase}/games/${id}/leave`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${auth.access_token}`,
				},
				body: JSON.stringify({ player_id: auth.id }),
				keepalive: true,
			}).catch(() => {})
		}

		window.addEventListener('beforeunload', handleBeforeUnload)

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
		}
	}, [id, auth.id, auth.access_token])

	// Auto-dismiss round winner overlay after 3 seconds
	useEffect(() => {
		const currentRound = game?.rounds?.find((r) => r?.number === round?.number)
		if (currentRound?.winning_card?.player_id === auth.id && !game?.winner) {
			setShowRoundWin(true)
			const timer = setTimeout(() => setShowRoundWin(false), 3000)
			return () => clearTimeout(timer)
		} else {
			setShowRoundWin(false)
		}
	}, [round?.winning_card, game?.winner])

	// Keep ref in sync for use in effects with limited dependency arrays
	useEffect(() => {
		handLengthRef.current = hand.length
	}, [hand.length])

	useEffect(() => {
		const getHand = () => {
			GET(`/cards/white/hand?gameId=${id}`).then((data) => setHand(data)).catch(() => showToast('Failed to load hand'))
		}

		const getBlackHand = () => {
			GET(`/cards/black/hand?gameId=${id}`).then((data) => setBlackHand(data)).catch(() => showToast('Failed to load black cards'))
		}

		const getWhiteCard = () => {
			GET(`/cards/white?gameId=${id}`).then((response) => setHand((prev) => [...prev, response])).catch(() => showToast('Failed to draw card'))
		}

		if (!game) return

		const isCzar = game?.rounds[game.rounds.length - 1]?.czar_id === auth.id

		// Clear stale hand when transitioning from czar to regular player
		if (wasCzarRef.current && !isCzar) {
			setHand([])
			setBlackHand([])
			handLengthRef.current = 0
		}

		if (isCzar) {
			getBlackHand()
		}

		if (handLengthRef.current === 0) {
			getHand()
		} else if (handLengthRef.current < 5) {
			getWhiteCard()
		}

		wasCzarRef.current = isCzar
	}, [game?.rounds.length])

	if (!auth.access_token) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen text-gray-500'>
				<p className='text-lg font-medium'>Not logged in</p>
				<p className='mt-1 text-sm'>Please log in to join a game.</p>
			</div>
		)
	}

	if (!game) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen text-gray-500'>
				<p className='text-lg'>Loading game...</p>
			</div>
		)
	}

	return (
		<>
			<div className='relative flex w-full h-screen overflow-hidden'>
				<button
					className='absolute top-0 z-50 flex items-center justify-center w-8 h-8 md:hidden left-2'
					onClick={toggleMenu}
				>
					<IconMenu size={42} />
				</button>

				<div
					className={classNames(
						'flex-col h-full p-4 border-r w-80 md:flex absolute md:relative left-0 top-0 z-40 bg-white pt-8 md:pt-0',
						{
							flex: menuVisible,
							hidden: !menuVisible,
						}
					)}
				>
					<Sidebar game={game} round={round} />

					<div className='mt-auto space-y-4'>
						{game.host === auth.id && game.rounds.length === 0 && (
							<button
								onClick={startGame}
								className='w-full button button-filled'
							>
								Start Game
							</button>
						)}
						<button onClick={leaveGame} className='w-full mt-auto button'>
							Leave Game
						</button>
					</div>
				</div>

				<div className='relative flex-1 w-full h-screen p-4'>
					{game?.rounds?.length === 0 && (
						<div className='flex items-center justify-center w-full h-full'>
							<p>This game hasn't started yet</p>
						</div>
					)}

					{game?.rounds.length > 0 && (
						<div className='flex flex-col h-full'>
							<p className='text-center md:text-left'>
								Round {game?.rounds[game.rounds.length - 1].number}
							</p>

							{/**
							 * CZAR VIEW
							 */}
							{round?.czar_id === auth.id && (
								<>
									<div className='flex items-center justify-center mb-4 space-x-2'>
										<IconCards size={16} />
										<p className='font-medium'>You are the Card Czar</p>
									</div>

									{!round.black_card && (
										<div className='flex flex-col items-center'>
											<div className='mb-4'>
												<p className='text-center'>Please select a card</p>
											</div>

											<CardContainer>
												{blackHand?.filter(Boolean)?.map((card) => (
													<Card
														key={card.id}
														{...card}
														onClick={() => handleSelectBlackCard(card)}
													/>
												))}
											</CardContainer>
										</div>
									)}

									{round?.black_card && (
										<div className='flex flex-col h-full'>
											<div className='flex items-center justify-center'>
												<Card key={round.black_card.id} {...round.black_card} />
											</div>

											{round?.white_cards?.length ===
												game?.players?.length - 1 && (
												<div className='mt-auto'>
													<p className='mb-4 text-center'>
														Please select a winner
													</p>
													<CardContainer className='mt-auto'>
														{round?.white_cards
															?.filter(Boolean)
															?.map((card) => (
																<Card
																	key={card.id}
																	{...card}
																	onClick={() => handleSelectWinningCard(card)}
																/>
															))}
													</CardContainer>
												</div>
											)}
										</div>
									)}
								</>
							)}

							{/**
							 * PLAYER VIEW
							 */}
							{round?.czar_id !== auth.id && (
								<>
									{round?.black_card ? (
										<div className='flex items-center justify-center'>
											<Card key={round.black_card.id} {...round.black_card} />
										</div>
									) : (
										<p>Waiting for the Card Czar to pick a card</p>
									)}

									<CardContainer className='py-2 mt-auto'>
										{hand?.filter(Boolean)?.map((card) => (
											<Card
												key={card.id}
												{...card}
												onClick={() =>
													round?.black_card && handleSelectWhiteCard(card)
												}
											/>
										))}
									</CardContainer>
								</>
							)}
						</div>
					)}

					{showRoundWin && (
							<>
								<div className='absolute top-0 left-0 flex items-center justify-center w-full h-full'>
									<div className='flex flex-col items-center justify-center'>
										<p className='text-4xl'>You won this round!</p>
										<ConfettiExplosion
											force={0.8}
											duration={5000}
											particleCount={500}
											width={1600}
											className='mx-auto z-[100]'
										/>
									</div>
								</div>
							</>
						)}

					{game.winner === auth.id && (
						<>
							<div className='absolute top-0 left-0 flex items-center justify-center w-full h-full'>
								<div className='flex flex-col items-center justify-center'>
									<IconCrown size={64} stroke={1} />
									<p className='text-4xl'>You won the game!</p>
									<ConfettiExplosion
										force={0.8}
										duration={15000}
										particleCount={1000}
										width={1600}
										className='mx-auto z-[100]'
									/>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	)
}
